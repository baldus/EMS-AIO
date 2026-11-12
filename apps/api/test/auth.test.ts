import { Controller, Get } from "@nestjs/common";
import { SignJWT } from "jose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, inject } from "vitest";
import { SEED_IDS } from "@ems/db";
import { createTestContext, USERS, type TestContext } from "./support/app";
import { TEST_AUDIENCE, TEST_ISSUER } from "./support/tokens";

/** A controller deliberately missing an authorization policy, to prove default deny. */
@Controller({ path: "no-policy", version: "1" })
class NoPolicyController {
  @Get()
  get() {
    return { leaked: true };
  }
}

let ctx: TestContext;
const http = () => request(ctx.app.getHttpServer());

beforeAll(async () => {
  ctx = await createTestContext(inject("databaseUrl"), [NoPolicyController]);
});
afterAll(async () => ctx.close());

describe("public endpoints", () => {
  it("serves liveness and readiness without authentication", async () => {
    await http().get("/health/live").expect(200, { status: "ok" });
    await http().get("/health/ready").expect(200, { status: "ok" });
  });
});

describe("authentication", () => {
  it("rejects requests without a token using problem+json", async () => {
    const res = await http().get("/v1/me").expect(401);
    expect(res.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(res.body).toMatchObject({ status: 401, code: "UNAUTHENTICATED", instance: "/v1/me" });
    expect(res.body.requestId).toEqual(expect.any(String));
  });

  it("rejects malformed authorization headers", async () => {
    await http().get("/v1/me").set("Authorization", "Basic abc").expect(401);
    await http().get("/v1/me").set("Authorization", "Bearer").expect(401);
  });

  it("rejects tokens signed by an untrusted key", async () => {
    const token = await ctx.idp.token(USERS.admin, { signWith: "untrusted" });
    await http().get("/v1/me").auth(token, { type: "bearer" }).expect(401);
  });

  it("rejects wrong issuer, wrong audience, and expired tokens", async () => {
    for (const token of [
      await ctx.idp.token(USERS.admin, { iss: "https://evil.test/realms/ems" }),
      await ctx.idp.token(USERS.admin, { aud: "some-other-api" }),
      await ctx.idp.token(USERS.admin, {
        issuedAt: Math.floor(Date.now() / 1000) - 3600,
        expiresIn: Math.floor(Date.now() / 1000) - 1800,
      }),
    ]) {
      await http().get("/v1/me").auth(token, { type: "bearer" }).expect(401);
    }
  });

  it("rejects symmetric (HS256) tokens even with a guessable secret", async () => {
    const token = await new SignJWT({ email: USERS.admin, email_verified: true })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(TEST_ISSUER)
      .setAudience(TEST_AUDIENCE)
      .setSubject("kc-attacker")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode("secret-secret-secret-secret-secret!"));
    await http().get("/v1/me").auth(token, { type: "bearer" }).expect(401);
  });

  it("denies authenticated identities that are not provisioned", async () => {
    const token = await ctx.idp.token("stranger@unknown.example.com");
    const res = await http().get("/v1/me").auth(token, { type: "bearer" }).expect(403);
    expect(res.body.code).toBe("USER_NOT_PROVISIONED");
  });

  it("does not link accounts on unverified email", async () => {
    const token = await ctx.idp.token(USERS.finance, {
      emailVerified: false,
      sub: "kc-unverified",
    });
    const res = await http().get("/v1/me").auth(token, { type: "bearer" }).expect(403);
    expect(res.body.code).toBe("USER_NOT_PROVISIONED");
  });

  it("links an invited user on first verified login and audits it", async () => {
    const token = await ctx.idp.mfa(USERS.manager);
    const res = await http().get("/v1/me").auth(token, { type: "bearer" }).expect(200);
    expect(res.body).toMatchObject({
      userId: SEED_IDS.users.manager,
      userType: "internal",
      mfaSatisfied: true,
      homeOrganizationName: "Engineered & Manufacturing Solutions, LTD",
    });
    expect(res.body.permissions).toContain("organization:create");

    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { id: SEED_IDS.users.manager } });
    expect(user.status).toBe("active");
    expect(user.oidcSubject).toBe(ctx.idp.subjectFor(USERS.manager));
    const linked = await ctx.prisma.auditEvent.count({
      where: { action: "user.identity_linked", entityId: SEED_IDS.users.manager },
    });
    expect(linked).toBe(1);
  });

  it("prevents a second identity from claiming an already-linked account", async () => {
    await http()
      .get("/v1/me")
      .auth(await ctx.idp.token(USERS.pm), { type: "bearer" })
      .expect(200);
    const hijack = await ctx.idp.token(USERS.pm, { sub: "kc-someone-else" });
    const res = await http().get("/v1/me").auth(hijack, { type: "bearer" }).expect(403);
    expect(res.body.code).toBe("USER_NOT_PROVISIONED");
  });

  it("denies suspended users", async () => {
    await ctx.prisma.user.create({
      data: {
        email: "suspended@ems.example.com",
        displayName: "Suspended (fictional)",
        userType: "internal",
        status: "suspended",
        homeOrganizationId: SEED_IDS.organizations.ems,
        oidcIssuer: TEST_ISSUER,
        oidcSubject: ctx.idp.subjectFor("suspended@ems.example.com"),
      },
    });
    const token = await ctx.idp.mfa("suspended@ems.example.com");
    const res = await http().get("/v1/me").auth(token, { type: "bearer" }).expect(403);
    expect(res.body.code).toBe("USER_INACTIVE");
  });
});

describe("default-deny authorization", () => {
  it("denies routes that declare no authorization policy, even for admins", async () => {
    const token = await ctx.idp.mfa(USERS.admin);
    const res = await http().get("/v1/no-policy").auth(token, { type: "bearer" }).expect(403);
    expect(res.body.code).toBe("NO_POLICY");
    expect(res.body).not.toHaveProperty("leaked");
  });

  it("requires MFA for roles that mandate it", async () => {
    const noMfa = await ctx.idp.token(USERS.manager);
    const res = await http().get("/v1/organizations").auth(noMfa, { type: "bearer" }).expect(403);
    expect(res.body.code).toBe("MFA_REQUIRED");

    const me = await http().get("/v1/me").auth(noMfa, { type: "bearer" }).expect(200);
    expect(me.body.mfaSatisfied).toBe(false);
    expect(me.body.permissions).toEqual([]);

    const withMfa = await ctx.idp.mfa(USERS.manager);
    await http().get("/v1/organizations").auth(withMfa, { type: "bearer" }).expect(200);
  });

  it("does not treat password-only amr as MFA", async () => {
    const token = await ctx.idp.token(USERS.manager, { amr: ["pwd"] });
    await http().get("/v1/organizations").auth(token, { type: "bearer" }).expect(403);
  });

  it("lets non-MFA roles work without MFA", async () => {
    const token = await ctx.idp.token(USERS.pm);
    await http().get("/v1/organizations").auth(token, { type: "bearer" }).expect(200);
  });
});
