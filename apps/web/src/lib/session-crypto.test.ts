import { describe, expect, it } from "vitest";
import { formToOrganizationFields } from "@/app/(app)/organizations/form-mapping";
import {
  COOKIE_CHUNK_SIZE,
  joinChunks,
  safeReturnTo,
  seal,
  splitIntoChunks,
  unseal,
} from "./session-crypto";

const SECRET = "test-secret-that-is-at-least-32-characters-long";

describe("sealed session payloads", () => {
  it("round-trips and is not readable without the secret", async () => {
    const token = await seal({ sub: "u1", accessToken: "at" }, SECRET, "session", 60);
    expect(token).not.toContain("u1");
    expect(await unseal(token, SECRET, "session")).toMatchObject({ sub: "u1", accessToken: "at" });
    expect(await unseal(token, `${SECRET}-other`, "session")).toBeNull();
  });

  it("rejects tampered tokens", async () => {
    const token = await seal({ sub: "u1" }, SECRET, "session", 60);
    const parts = token.split(".");
    parts[3] = `${parts[3]!.slice(0, -2)}AA`;
    expect(await unseal(parts.join("."), SECRET, "session")).toBeNull();
  });

  it("binds tokens to their purpose (login state cannot be used as a session)", async () => {
    const login = await seal({ state: "s" }, SECRET, "login", 60);
    expect(await unseal(login, SECRET, "session")).toBeNull();
  });

  it("rejects expired tokens", async () => {
    const token = await seal({ sub: "u1" }, SECRET, "session", -10);
    expect(await unseal(token, SECRET, "session")).toBeNull();
  });
});

describe("cookie chunking", () => {
  it("splits and rejoins large values", () => {
    const value = "x".repeat(COOKIE_CHUNK_SIZE * 2 + 17);
    const chunks = splitIntoChunks(value);
    expect(chunks).toHaveLength(3);
    const jar = new Map(chunks.map((c, i) => [`s.${i}`, c]));
    expect(joinChunks((n) => jar.get(n), "s")).toBe(value);
  });

  it("refuses values too large to store", () => {
    expect(() => splitIntoChunks("x".repeat(COOKIE_CHUNK_SIZE * 5))).toThrow();
  });
});

describe("safeReturnTo (open redirect protection)", () => {
  it.each([
    ["/organizations?x=1", "/organizations?x=1"],
    ["https://evil.example", "/dashboard"],
    ["//evil.example", "/dashboard"],
    ["/\\evil.example", "/dashboard"],
    ["/ok\r\nSet-Cookie: x", "/dashboard"],
    [null, "/dashboard"],
  ])("%s -> %s", (input, expected) => {
    expect(safeReturnTo(input)).toBe(expected);
  });
});

describe("organization form mapping", () => {
  const fd = (entries: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(entries)) f.set(k, v);
    return f;
  };

  it("omits blank optional fields on create", () => {
    expect(
      formToOrganizationFields(
        fd({ name: "Acme", kind: "prospect", city: " ", notes: "n" }),
        "create",
      ),
    ).toEqual({
      name: "Acme",
      kind: "prospect",
      notes: "n",
    });
  });

  it("clears blank optional fields on update", () => {
    expect(
      formToOrganizationFields(fd({ name: "Acme", city: "", status: "inactive" }), "update"),
    ).toEqual({
      name: "Acme",
      city: null,
      status: "inactive",
    });
  });
});

describe("allowsInsecureHttp", () => {
  const base = {
    NODE_ENV: "production" as const,
    APP_URL: "http://localhost:3100",
    API_BASE_URL: "http://localhost:4100",
    OIDC_ISSUER_URL: "http://localhost:9400",
    OIDC_CLIENT_ID: "c",
    OIDC_CLIENT_SECRET: "s",
    OIDC_SCOPES: "openid",
    SESSION_SECRET: "x".repeat(32),
    E2E_ALLOW_HTTP: "true" as const,
  };

  it("only permits http in production for the localhost e2e configuration", async () => {
    const { allowsInsecureHttp } = await import("./env");
    expect(allowsInsecureHttp(base)).toBe(true);
    expect(allowsInsecureHttp({ ...base, E2E_ALLOW_HTTP: "false" })).toBe(false);
    expect(allowsInsecureHttp({ ...base, OIDC_ISSUER_URL: "http://idp.example.com" })).toBe(false);
    expect(allowsInsecureHttp({ ...base, NODE_ENV: "development", E2E_ALLOW_HTTP: "false" })).toBe(
      true,
    );
  });
});
