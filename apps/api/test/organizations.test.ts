import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, inject } from "vitest";
import { SEED_IDS, verifyAuditChain } from "@ems/db";
import { createTestContext, USERS, type TestContext } from "./support/app";

let ctx: TestContext;
const http = () => request(ctx.app.getHttpServer());
const O = SEED_IDS.organizations;

let admin: string;
let manager: string;
let pm: string;
let harborLead: string;

beforeAll(async () => {
  ctx = await createTestContext(inject("databaseUrl"));
  admin = await ctx.idp.mfa(USERS.admin);
  manager = await ctx.idp.mfa(USERS.manager);
  pm = await ctx.idp.token(USERS.pm);
  harborLead = await ctx.idp.mfa(USERS.harborLead);
});
afterAll(async () => ctx.close());

function createOrg(token: string, body: Record<string, unknown>) {
  return http()
    .post("/v1/organizations")
    .auth(token, { type: "bearer" })
    .send({ kind: "prospect", ...body });
}

describe("listing and tenant isolation", () => {
  it("lists all non-archived organizations for global readers", async () => {
    const res = await http().get("/v1/organizations").auth(admin, { type: "bearer" }).expect(200);
    const names = res.body.data.map((o: { name: string }) => o.name);
    expect(names).toEqual(
      expect.arrayContaining(["Harbor Point Automation", "Copperline Machine Works"]),
    );
    expect(res.body.meta).toMatchObject({ page: 1, pageSize: 25 });
  });

  it("supports search, filters, sorting, and pagination", async () => {
    const res = await http()
      .get("/v1/organizations")
      .query({ search: "harbor", kind: "customer", pageSize: 1, sort: "name", order: "desc" })
      .auth(admin, { type: "bearer" })
      .expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe("Harbor Point Automation");
    expect(res.body.meta.total).toBe(1);
  });

  it("rejects invalid query parameters", async () => {
    const res = await http()
      .get("/v1/organizations")
      .query({ pageSize: 1000 })
      .auth(admin, { type: "bearer" })
      .expect(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });

  it("shows customers only their own organization", async () => {
    const res = await http()
      .get("/v1/organizations")
      .auth(harborLead, { type: "bearer" })
      .expect(200);
    expect(res.body.data.map((o: { id: string }) => o.id)).toEqual([O.harborPoint]);
  });

  it("returns 404 (not 403) for another tenant's organization", async () => {
    const res = await http()
      .get(`/v1/organizations/${O.copperline}`)
      .auth(harborLead, { type: "bearer" })
      .expect(404);
    expect(res.body.code).toBe("NOT_FOUND");
    await http()
      .get(`/v1/organizations/${O.harborPoint}`)
      .auth(harborLead, { type: "bearer" })
      .expect(200);
  });

  it("validates path parameters", async () => {
    await http().get("/v1/organizations/not-a-uuid").auth(admin, { type: "bearer" }).expect(400);
  });
});

describe("creating organizations", () => {
  it("creates an organization and writes an audit event in the same transaction", async () => {
    const res = await createOrg(manager, {
      name: "  Silver   Fjord Robotics ",
      segment: "robotics_integrator",
      countryCode: "us",
      website: "https://silverfjord.example.com",
    }).expect(201);
    expect(res.body).toMatchObject({
      name: "Silver Fjord Robotics",
      kind: "prospect",
      status: "active",
      countryCode: "US",
      version: 1,
    });
    const audit = await ctx.prisma.auditEvent.findFirstOrThrow({
      where: { entityId: res.body.id, action: "organization.created" },
    });
    expect(audit.actorUserId).toBe(SEED_IDS.users.manager);
    expect(audit.organizationId).toBe(res.body.id);
    expect((audit.after as { name: string }).name).toBe("Silver Fjord Robotics");
  });

  it("denies creation to users without the permission", async () => {
    const res = await createOrg(pm, { name: "Not Allowed Co" }).expect(403);
    expect(res.body.code).toBe("FORBIDDEN");
    await createOrg(harborLead, { name: "Not Allowed Either" }).expect(403);
  });

  it("validates input and rejects unknown or server-managed fields", async () => {
    const missing = await createOrg(manager, {}).expect(400);
    expect(missing.body.code).toBe("VALIDATION_FAILED");
    await createOrg(manager, { name: "Valid Name", id: randomUUID() }).expect(400);
    await createOrg(manager, { name: "Valid Name", version: 7 }).expect(400);
    await createOrg(manager, { name: "Valid Name", website: "javascript:alert(1)" }).expect(400);
    await createOrg(manager, { name: "Fake Operator", kind: "ems_operator" }).expect(400);
  });

  it("rejects owners who are not internal users", async () => {
    const res = await createOrg(manager, {
      name: "Owner Check Co",
      ownerUserId: SEED_IDS.users.harborLead,
    }).expect(422);
    expect(res.body.errors[0].code).toBe("INVALID_OWNER");
  });

  it("is idempotent with an Idempotency-Key", async () => {
    const key = `test-${randomUUID()}`;
    const body = { name: "Idempotent Industries" };
    const first = await createOrg(manager, body).set("Idempotency-Key", key).expect(201);
    const second = await createOrg(manager, body).set("Idempotency-Key", key).expect(201);
    expect(second.headers["idempotent-replayed"]).toBe("true");
    expect(second.body.id).toBe(first.body.id);
    expect(await ctx.prisma.organization.count({ where: { name: "Idempotent Industries" } })).toBe(
      1,
    );

    const conflict = await createOrg(manager, { name: "Different Body" })
      .set("Idempotency-Key", key)
      .expect(422);
    expect(conflict.body.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("creates exactly once under concurrent retries", async () => {
    const key = `test-${randomUUID()}`;
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        createOrg(manager, { name: "Concurrent Castings" }).set("Idempotency-Key", key),
      ),
    );
    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
    expect(await ctx.prisma.organization.count({ where: { name: "Concurrent Castings" } })).toBe(1);
    expect(
      await ctx.prisma.auditEvent.count({
        where: { action: "organization.created", entityId: results[0]!.body.id },
      }),
    ).toBe(1);
  });
});

describe("updating, archiving, and restoring", () => {
  it("enforces optimistic concurrency and audits only the changed fields", async () => {
    const created = await createOrg(manager, {
      name: "Versioned Valves",
      industry: "Valves",
    }).expect(201);
    const id = created.body.id as string;

    const updated = await http()
      .patch(`/v1/organizations/${id}`)
      .auth(manager, { type: "bearer" })
      .send({ version: 1, industry: "Industrial valves", kind: "customer" })
      .expect(200);
    expect(updated.body).toMatchObject({
      version: 2,
      industry: "Industrial valves",
      kind: "customer",
    });

    const stale = await http()
      .patch(`/v1/organizations/${id}`)
      .auth(manager, { type: "bearer" })
      .send({ version: 1, industry: "Lost update" })
      .expect(409);
    expect(stale.body.code).toBe("VERSION_CONFLICT");

    const audit = await ctx.prisma.auditEvent.findFirstOrThrow({
      where: { entityId: id, action: "organization.updated" },
    });
    expect(audit.before).toEqual({ industry: "Valves", kind: "prospect" });
    expect(audit.after).toEqual({ industry: "Industrial valves", kind: "customer" });
  });

  it("enforces kind transition rules", async () => {
    const res = await http()
      .patch(`/v1/organizations/${O.copperline}`)
      .auth(manager, { type: "bearer" })
      .send({ version: 1, kind: "prospect" })
      .expect(422);
    expect(res.body.errors[0].code).toBe("KIND_TRANSITION_NOT_ALLOWED");
  });

  it("does not let customers edit their own organization", async () => {
    await http()
      .patch(`/v1/organizations/${O.harborPoint}`)
      .auth(harborLead, { type: "bearer" })
      .send({ version: 1, notes: "self-edit" })
      .expect(403);
  });

  it("archives and restores with privileged permission; archived records are read-only", async () => {
    const created = await createOrg(manager, { name: "Archivable Automation" }).expect(201);
    const id = created.body.id as string;

    await http()
      .post(`/v1/organizations/${id}/archive`)
      .auth(pm, { type: "bearer" })
      .send({ version: 1 })
      .expect(403);

    const archived = await http()
      .post(`/v1/organizations/${id}/archive`)
      .auth(manager, { type: "bearer" })
      .send({ version: 1 })
      .expect(200);
    expect(archived.body).toMatchObject({ status: "archived", version: 2 });
    expect(archived.body.archivedAt).toEqual(expect.any(String));

    const list = await http()
      .get("/v1/organizations")
      .query({ search: "Archivable" })
      .auth(manager, { type: "bearer" });
    expect(list.body.data).toHaveLength(0);
    const withArchived = await http()
      .get("/v1/organizations")
      .query({ search: "Archivable", includeArchived: "true" })
      .auth(manager, { type: "bearer" });
    expect(withArchived.body.data).toHaveLength(1);

    const edit = await http()
      .patch(`/v1/organizations/${id}`)
      .auth(manager, { type: "bearer" })
      .send({ version: 2, notes: "editing archived" })
      .expect(422);
    expect(edit.body.errors[0].code).toBe("ARCHIVED_READ_ONLY");

    const restored = await http()
      .post(`/v1/organizations/${id}/restore`)
      .auth(manager, { type: "bearer" })
      .send({ version: 2 })
      .expect(200);
    expect(restored.body).toMatchObject({ status: "active", archivedAt: null, version: 3 });
  });

  it("protects the EMS operator organization", async () => {
    const res = await http()
      .post(`/v1/organizations/${O.ems}/archive`)
      .auth(admin, { type: "bearer" })
      .send({ version: 1 })
      .expect(422);
    expect(res.body.errors[0].code).toBe("OPERATOR_IMMUTABLE");
  });
});

describe("audit history", () => {
  it("lets global audit readers list and verify the hash chain", async () => {
    const list = await http()
      .get("/v1/audit-events")
      .query({ entityType: "organization", action: "organization.created" })
      .auth(admin, { type: "bearer" })
      .expect(200);
    expect(list.body.data.length).toBeGreaterThan(0);
    expect(list.body.data[0]).toMatchObject({ actorType: "user", entityType: "organization" });

    const verify = await http()
      .get("/v1/audit-events/verify")
      .auth(admin, { type: "bearer" })
      .expect(200);
    expect(verify.body).toMatchObject({ ok: true, firstInvalidSequence: null });
    expect((await verifyAuditChain(ctx.prisma)).ok).toBe(true);
  });

  it("denies audit access to users without the permission", async () => {
    await http().get("/v1/audit-events").auth(pm, { type: "bearer" }).expect(403);
    await http().get("/v1/audit-events").auth(harborLead, { type: "bearer" }).expect(403);
  });
});
