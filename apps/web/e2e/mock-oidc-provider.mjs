// Minimal OpenID Connect provider FOR END-TO-END TESTS ONLY.
//
// It implements just enough of the Authorization Code + PKCE flow (discovery, authorize, token,
// refresh, JWKS, end-session) to exercise the web app's real OIDC client code. It is not a
// security component and must never be used outside tests. Local development uses Keycloak
// (infra/docker-compose.yml).
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

const b64url = (buf) => Buffer.from(buf).toString("base64url");

export async function startMockOidcProvider({
  port,
  clientId,
  clientSecret,
  audience,
  ttlFor = () => 300,
}) {
  const issuer = `http://localhost:${port}`;
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "e2e-key", alg: "RS256", use: "sig" };
  const codes = new Map();
  const refreshTokens = new Map();
  const stats = { refreshes: 0 };

  async function issueTokens(grant) {
    const now = Math.floor(Date.now() / 1000);
    const ttl = ttlFor(grant.email);
    const common = { email: grant.email, email_verified: true, name: grant.name };
    const accessToken = await new SignJWT({ ...common, amr: grant.amr, azp: clientId })
      .setProtectedHeader({ alg: "RS256", kid: "e2e-key" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(grant.sub)
      .setIssuedAt(now)
      .setExpirationTime(now + ttl)
      .setJti(randomUUID())
      .sign(privateKey);
    const idToken = await new SignJWT({ ...common, nonce: grant.nonce, amr: grant.amr })
      .setProtectedHeader({ alg: "RS256", kid: "e2e-key" })
      .setIssuer(issuer)
      .setAudience(clientId)
      .setSubject(grant.sub)
      .setIssuedAt(now)
      .setExpirationTime(now + 300)
      .sign(privateKey);
    const refreshToken = b64url(randomBytes(32));
    refreshTokens.set(refreshToken, { ...grant, nonce: undefined });
    return {
      access_token: accessToken,
      id_token: idToken,
      refresh_token: refreshToken,
      token_type: "Bearer",
      expires_in: ttl,
      scope: "openid profile email",
    };
  }

  function clientAuthenticated(req, form) {
    const header = req.headers.authorization ?? "";
    if (header.startsWith("Basic ")) {
      const [id, secret] = Buffer.from(header.slice(6), "base64")
        .toString()
        .split(":")
        .map(decodeURIComponent);
      return id === clientId && secret === clientSecret;
    }
    return form.get("client_id") === clientId && form.get("client_secret") === clientSecret;
  }

  const readBody = (req) =>
    new Promise((resolve) => {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => resolve(new URLSearchParams(data)));
    });

  const json = (res, status, body) => {
    res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(body));
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, issuer);
    try {
      if (url.pathname === "/.well-known/openid-configuration") {
        return json(res, 200, {
          issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/token`,
          jwks_uri: `${issuer}/jwks`,
          end_session_endpoint: `${issuer}/logout`,
          response_types_supported: ["code"],
          subject_types_supported: ["public"],
          id_token_signing_alg_values_supported: ["RS256"],
          code_challenge_methods_supported: ["S256"],
          token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
          grant_types_supported: ["authorization_code", "refresh_token"],
        });
      }
      if (url.pathname === "/jwks") return json(res, 200, { keys: [jwk] });

      if (url.pathname === "/authorize" && req.method === "GET") {
        const p = url.searchParams;
        const problems = [];
        if (p.get("client_id") !== clientId) problems.push("client_id");
        if (p.get("response_type") !== "code") problems.push("response_type");
        if (p.get("code_challenge_method") !== "S256" || !p.get("code_challenge"))
          problems.push("pkce");
        if (!p.get("state") || !p.get("nonce")) problems.push("state/nonce");
        if (problems.length) return json(res, 400, { error: "invalid_request", problems });
        res.writeHead(200, { "content-type": "text/html" });
        return res.end(`<!doctype html><title>Mock IdP</title><h1>Mock IdP sign-in</h1>
          <form method="post" action="/authorize">
            ${[...p].map(([k, v]) => `<input type="hidden" name="${k}" value="${v.replace(/"/g, "&quot;")}">`).join("")}
            <label>Email <input name="login_email" id="login_email"></label>
            <label><input type="checkbox" name="mfa" id="mfa" value="1"> Complete MFA (TOTP)</label>
            <button type="submit" id="approve">Sign in</button>
          </form>`);
      }
      if (url.pathname === "/authorize" && req.method === "POST") {
        const f = await readBody(req);
        const email = f.get("login_email");
        const code = b64url(randomBytes(24));
        codes.set(code, {
          sub: `mock|${email}`,
          email,
          name: email.split("@")[0],
          nonce: f.get("nonce"),
          challenge: f.get("code_challenge"),
          redirectUri: f.get("redirect_uri"),
          amr: f.get("mfa") ? ["pwd", "otp"] : ["pwd"],
          expires: Date.now() + 60_000,
        });
        const target = new URL(f.get("redirect_uri"));
        target.searchParams.set("code", code);
        target.searchParams.set("state", f.get("state"));
        target.searchParams.set("iss", issuer);
        res.writeHead(302, { location: target.toString() });
        return res.end();
      }

      if (url.pathname === "/token" && req.method === "POST") {
        const f = await readBody(req);
        if (!clientAuthenticated(req, f)) return json(res, 401, { error: "invalid_client" });
        if (f.get("grant_type") === "authorization_code") {
          const grant = codes.get(f.get("code"));
          codes.delete(f.get("code")); // single use
          if (!grant || grant.expires < Date.now() || grant.redirectUri !== f.get("redirect_uri")) {
            return json(res, 400, { error: "invalid_grant" });
          }
          const challenge = b64url(
            createHash("sha256")
              .update(f.get("code_verifier") ?? "")
              .digest(),
          );
          if (challenge !== grant.challenge)
            return json(res, 400, { error: "invalid_grant", detail: "pkce" });
          return json(res, 200, await issueTokens(grant));
        }
        if (f.get("grant_type") === "refresh_token") {
          const grant = refreshTokens.get(f.get("refresh_token"));
          refreshTokens.delete(f.get("refresh_token")); // rotation
          if (!grant) return json(res, 400, { error: "invalid_grant" });
          stats.refreshes += 1;
          return json(res, 200, await issueTokens(grant));
        }
        return json(res, 400, { error: "unsupported_grant_type" });
      }

      if (url.pathname === "/logout") {
        const target = url.searchParams.get("post_logout_redirect_uri") ?? "/";
        res.writeHead(302, { location: target });
        return res.end();
      }
      json(res, 404, { error: "not_found" });
    } catch (err) {
      json(res, 500, { error: "server_error", detail: String(err) });
    }
  });

  await new Promise((resolve) => server.listen(port, resolve));
  return { issuer, stats, close: () => new Promise((r) => server.close(r)) };
}
