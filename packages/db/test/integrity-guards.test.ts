import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { appendAuditEvent, verifyAuditChain } from "../src/audit";
import { SEED_IDS } from "../src/fixtures";
import { seedDatabase } from "../src/seed-data";

const prisma = new PrismaClient({ datasourceUrl: inject("databaseUrl") });
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const O = SEED_IDS.organizations;
const U = SEED_IDS.users;

async function activate(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { status: "active" } });
}

async function createDocumentRevision(content: string) {
  const doc = await prisma.document.create({
    data: {
      organizationId: O.harborPoint,
      projectId: SEED_IDS.projects.harborPalletizing,
      title: "Fictional change request form",
      documentType: "change_request",
    },
  });
  return prisma.documentRevision.create({
    data: {
      documentId: doc.id,
      revisionNumber: 1,
      storageKey: `test/${doc.id}/1`,
      contentSha256: sha(content),
      sizeBytes: BigInt(content.length),
      mimeType: "application/pdf",
      createdById: U.pm,
    },
  });
}

beforeAll(async () => {
  await seedDatabase(prisma);
  await activate(U.harborEngineer);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("seed", () => {
  it("is idempotent and creates no approvals", async () => {
    await seedDatabase(prisma);
    expect(await prisma.organization.count({ where: { kind: "ems_operator" } })).toBe(1);
    expect(await prisma.approval.count()).toBe(0);
    expect(await prisma.payment.count()).toBe(0);
  });
});

describe("audit_events", () => {
  it("rejects UPDATE, DELETE, and TRUNCATE", async () => {
    const e = await prisma.$transaction((tx) =>
      appendAuditEvent(tx, { actorType: "system", action: "test.event", entityType: "test" }),
    );
    await expect(
      prisma.auditEvent.update({ where: { id: e.id }, data: { action: "tampered" } }),
    ).rejects.toThrow(/append-only/);
    await expect(prisma.auditEvent.delete({ where: { id: e.id } })).rejects.toThrow(/append-only/);
    await expect(prisma.$executeRawUnsafe("TRUNCATE audit_events")).rejects.toThrow(/append-only/);
  });

  it("maintains a verifiable hash chain under concurrent appends", async () => {
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        prisma.$transaction((tx) =>
          appendAuditEvent(tx, {
            actorType: "system",
            action: "test.concurrent",
            entityType: "test",
            metadata: { i, at: new Date(), big: 10n },
          }),
        ),
      ),
    );
    const result = await verifyAuditChain(prisma);
    expect(result.ok).toBe(true);
    expect(result.eventsChecked).toBeGreaterThanOrEqual(11);
  });

  it("requires an actor id for user actors", async () => {
    await expect(
      prisma.$transaction((tx) =>
        appendAuditEvent(tx, { actorType: "user", action: "x", entityType: "test" }),
      ),
    ).rejects.toThrow(/audit_events_actor_chk/);
  });
});

describe("approvals", () => {
  const baseApproval = (revisionId: string, hash: string, key: string) => ({
    purpose: "change_request_commercial",
    level: 2,
    decision: "approved" as const,
    documentRevisionId: revisionId,
    contentSha256: hash,
    organizationId: O.harborPoint,
    approverUserId: U.harborEngineer,
    authorityBasis: { test: true },
    mfaVerified: true,
    idempotencyKey: key,
  });

  it("assigns decided_at from the database clock (no backdating)", async () => {
    const rev = await createDocumentRevision("rev-a");
    const backdated = new Date("2020-01-01T00:00:00.000Z");
    const a = await prisma.approval.create({
      data: { ...baseApproval(rev.id, rev.contentSha256, randomUUID()), decidedAt: backdated },
    });
    expect(a.decidedAt.getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it("rejects approvals whose hash does not match the exact revision", async () => {
    const rev = await createDocumentRevision("rev-b");
    await expect(
      prisma.approval.create({ data: baseApproval(rev.id, sha("something else"), randomUUID()) }),
    ).rejects.toThrow(/content hash does not match/);
  });

  it("rejects approvals by inactive users", async () => {
    const rev = await createDocumentRevision("rev-c");
    await expect(
      prisma.approval.create({
        data: {
          ...baseApproval(rev.id, rev.contentSha256, randomUUID()),
          approverUserId: U.copperlineBuyer,
        },
      }),
    ).rejects.toThrow(/active human user/);
  });

  it("is immutable once recorded", async () => {
    const rev = await createDocumentRevision("rev-d");
    const a = await prisma.approval.create({
      data: baseApproval(rev.id, rev.contentSha256, randomUUID()),
    });
    await expect(
      prisma.approval.update({ where: { id: a.id }, data: { decision: "rejected" } }),
    ).rejects.toThrow(/append-only/);
  });

  it("requires exactly one target and MFA", async () => {
    const rev = await createDocumentRevision("rev-e");
    await expect(
      prisma.approval.create({
        data: { ...baseApproval(rev.id, rev.contentSha256, randomUUID()), mfaVerified: false },
      }),
    ).rejects.toThrow(/approvals_mfa_chk/);
  });
});

describe("document_revisions", () => {
  it("cannot be modified after creation", async () => {
    const rev = await createDocumentRevision("immutable");
    await expect(
      prisma.documentRevision.update({ where: { id: rev.id }, data: { contentSha256: sha("x") } }),
    ).rejects.toThrow(/append-only/);
  });
});

describe("baselines", () => {
  it("cannot be approved without a matching approval and are immutable afterwards", async () => {
    const snapshot = { tasks: 3 };
    const hash = sha(JSON.stringify(snapshot));
    const b = await prisma.baseline.create({
      data: {
        projectId: SEED_IDS.projects.harborPalletizing,
        kind: "schedule",
        revision: 1,
        status: "submitted",
        snapshot,
        contentSha256: hash,
      },
    });
    await expect(
      prisma.baseline.update({
        where: { id: b.id },
        data: { status: "approved", approvedAt: new Date() },
      }),
    ).rejects.toThrow(/without a matching approval/);

    await prisma.approval.create({
      data: {
        purpose: "baseline_approval",
        level: 2,
        decision: "approved",
        baselineId: b.id,
        contentSha256: hash,
        organizationId: O.harborPoint,
        approverUserId: U.harborEngineer,
        authorityBasis: { test: true },
        mfaVerified: true,
        idempotencyKey: randomUUID(),
      },
    });
    await prisma.baseline.update({
      where: { id: b.id },
      data: { status: "approved", approvedAt: new Date() },
    });
    await expect(
      prisma.baseline.update({ where: { id: b.id }, data: { snapshot: { tasks: 4 } } }),
    ).rejects.toThrow(/immutable/);
    await expect(prisma.baseline.delete({ where: { id: b.id } })).rejects.toThrow(/draft/);
  });
});

describe("payments", () => {
  it("cannot be verified without evidence and an internal verifier", async () => {
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: O.harborPoint,
        engagementId: SEED_IDS.engagements.harborRetainer,
        number: `TEST-${randomUUID().slice(0, 8)}`,
        subtotalCents: 100_00n,
        totalCents: 100_00n,
      },
    });
    const base = {
      invoiceId: invoice.id,
      organizationId: O.harborPoint,
      amountCents: 100_00n,
      currency: "USD",
      receivedOn: new Date("2026-11-01T00:00:00Z"),
      method: "ach" as const,
    };
    await expect(
      prisma.payment.create({
        data: { ...base, status: "verified", idempotencyKey: randomUUID() },
      }),
    ).rejects.toThrow(/payments_verified_chk|active internal user/);

    const evidence = await createDocumentRevision("remittance");
    await expect(
      prisma.payment.create({
        data: {
          ...base,
          status: "verified",
          evidenceDocumentRevisionId: evidence.id,
          verifiedById: U.harborEngineer, // customer user: not allowed
          verifiedAt: new Date(),
          idempotencyKey: randomUUID(),
        },
      }),
    ).rejects.toThrow(/internal user/);
  });
});

describe("agent_actions", () => {
  it("prevents agents from executing actions that require approval", async () => {
    const run = await prisma.agentRun.create({
      data: { agentKey: "finance", agentVersion: "0.0.0-test", triggerType: "manual", input: {} },
    });
    await expect(
      prisma.agentAction.create({
        data: {
          agentRunId: run.id,
          sequence: 1,
          action: "invoice.release",
          requiredApprovalLevel: 1,
          status: "executed",
        },
      }),
    ).rejects.toThrow(/agent_actions_execute_level_chk/);
    await expect(
      prisma.agentAction.create({
        data: {
          agentRunId: run.id,
          sequence: 2,
          action: "invoice.release",
          requiredApprovalLevel: 1,
          status: "applied",
        },
      }),
    ).rejects.toThrow(/agent_actions_applied_chk/);
  });
});

describe("tenancy and uniqueness", () => {
  it("allows only one EMS operator organization", async () => {
    await expect(
      prisma.organization.create({ data: { name: "Second Operator", kind: "ems_operator" } }),
    ).rejects.toThrow(/Unique constraint/);
  });

  it("enforces case-insensitive unique emails", async () => {
    await expect(
      prisma.user.create({
        data: {
          email: "ADMIN@ems.example.com",
          displayName: "Dup",
          userType: "internal",
          homeOrganizationId: O.ems,
        },
      }),
    ).rejects.toThrow(/Unique constraint/);
  });
});
