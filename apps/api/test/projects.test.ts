import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, inject } from "vitest";
import { SEED_IDS } from "@ems/db";
import { createTestContext, USERS, type TestContext } from "./support/app";

let ctx: TestContext;
const http = () => request(ctx.app.getHttpServer());
const PR = SEED_IDS.projects;
const codes = (body: { data: { code: string }[] }) => body.data.map((p) => p.code).sort();

beforeAll(async () => {
  ctx = await createTestContext(inject("databaseUrl"));
});
afterAll(async () => ctx.close());

describe("project-level authorization", () => {
  it("shows an EMS PM only the projects they are a member of", async () => {
    const res = await http()
      .get("/v1/projects")
      .auth(await ctx.idp.token(USERS.pm), { type: "bearer" })
      .expect(200);
    expect(codes(res.body)).toEqual(["CMW-2026-001", "HPA-2026-001"]);
  });

  it("shows customer admins all of their organization's projects only", async () => {
    const token = await ctx.idp.mfa(USERS.harborLead);
    const res = await http().get("/v1/projects").auth(token, { type: "bearer" }).expect(200);
    expect(codes(res.body)).toEqual(["HPA-2026-001"]);
    await http()
      .get(`/v1/projects/${PR.copperlinePress}`)
      .auth(token, { type: "bearer" })
      .expect(404);
  });

  it("gives customer approvers access through membership (with MFA)", async () => {
    const noMfa = await ctx.idp.token(USERS.copperlineBuyer);
    const denied = await http().get("/v1/projects").auth(noMfa, { type: "bearer" }).expect(403);
    expect(denied.body.code).toBe("MFA_REQUIRED");

    const token = await ctx.idp.mfa(USERS.copperlineBuyer);
    const res = await http().get("/v1/projects").auth(token, { type: "bearer" }).expect(200);
    expect(codes(res.body)).toEqual(["CMW-2026-001"]);
  });

  it("denies project access to internal roles without project permission", async () => {
    const token = await ctx.idp.mfa(USERS.finance);
    await http().get("/v1/projects").auth(token, { type: "bearer" }).expect(403);
  });

  it("returns project detail with engagements kept distinct from the project", async () => {
    const token = await ctx.idp.token(USERS.pm);
    const res = await http()
      .get(`/v1/projects/${PR.harborPalletizing}`)
      .auth(token, { type: "bearer" })
      .expect(200);
    expect(res.body).toMatchObject({
      code: "HPA-2026-001",
      organization: { id: SEED_IDS.organizations.harborPoint },
      startDate: "2026-09-01",
    });
    expect(res.body.engagements).toEqual([
      expect.objectContaining({ commercialModel: "monthly_retainer", status: "active" }),
    ]);

    const members = await http()
      .get(`/v1/projects/${PR.harborPalletizing}/members`)
      .auth(token, { type: "bearer" })
      .expect(200);
    expect(members.body.map((m: { roleKey: string }) => m.roleKey).sort()).toEqual([
      "customer_technical_approver",
      "project_manager",
    ]);
  });
});

describe("dashboard", () => {
  it("scopes counts to the caller's tenant", async () => {
    const customer = await http()
      .get("/v1/dashboard/summary")
      .auth(await ctx.idp.mfa(USERS.harborLead), { type: "bearer" })
      .expect(200);
    expect(customer.body.organizationsByKind).toEqual([{ kind: "customer", count: 1 }]);
    expect(customer.body.activeProjects).toBe(1);
    expect(customer.body.recentActivity).toEqual([]);

    const admin = await http()
      .get("/v1/dashboard/summary")
      .auth(await ctx.idp.mfa(USERS.admin), { type: "bearer" })
      .expect(200);
    const total = admin.body.organizationsByKind.reduce(
      (n: number, k: { count: number }) => n + k.count,
      0,
    );
    expect(total).toBeGreaterThanOrEqual(5);
    expect(admin.body.recentActivity.length).toBeGreaterThan(0);
  });
});
