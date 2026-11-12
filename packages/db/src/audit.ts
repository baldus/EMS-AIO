import { createHash, randomUUID } from "node:crypto";
import { canonicalJson } from "@ems/domain";
import { Prisma, type AuditEvent, type PrismaClient } from "@prisma/client";

/** Arbitrary constant used with pg_advisory_xact_lock to serialize audit chain appends. */
export const AUDIT_CHAIN_LOCK_KEY = 72_310_001;

export type AuditActorType = "user" | "agent" | "system" | "workflow";

export interface AuditEventInput {
  actorType: AuditActorType;
  actorUserId?: string | null;
  actorAgentRunId?: string | null;
  organizationId?: string | null;
  projectId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

/** Converts values to a JSON-safe form so the stored JSON hashes identically to the input. */
export function toAuditJson(value: unknown): JsonValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(toAuditJson);
  if (typeof value === "object") {
    // Prisma.Decimal and similar expose toJSON.
    const maybe = value as { toJSON?: () => unknown };
    if (typeof maybe.toJSON === "function" && !(value.constructor === Object)) {
      return toAuditJson(maybe.toJSON());
    }
    const out: Record<string, JsonValue> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = toAuditJson(v);
    }
    return out;
  }
  return null;
}

interface HashableAuditEvent {
  id: string;
  occurredAt: Date;
  actorType: string;
  actorUserId: string | null;
  actorAgentRunId: string | null;
  organizationId: string | null;
  projectId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  metadata: unknown;
  requestId: string | null;
  prevHash: string | null;
}

export function computeAuditHash(e: HashableAuditEvent): string {
  const payload = canonicalJson({
    id: e.id,
    occurredAt: e.occurredAt.toISOString(),
    actorType: e.actorType,
    actorUserId: e.actorUserId,
    actorAgentRunId: e.actorAgentRunId,
    organizationId: e.organizationId,
    projectId: e.projectId,
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId,
    before: e.before ?? null,
    after: e.after ?? null,
    metadata: e.metadata ?? null,
    requestId: e.requestId,
    prevHash: e.prevHash,
  });
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Appends an audit event inside the caller's transaction so that the event commits atomically with
 * the change it describes. Appends are serialized with a transaction-scoped advisory lock so the
 * hash chain is linear.
 */
export async function appendAuditEvent(
  tx: Prisma.TransactionClient,
  input: AuditEventInput,
): Promise<AuditEvent> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${AUDIT_CHAIN_LOCK_KEY})`;
  const last = await tx.auditEvent.findFirst({
    orderBy: { sequence: "desc" },
    select: { hash: true },
  });

  const event: HashableAuditEvent = {
    id: randomUUID(),
    occurredAt: new Date(),
    actorType: input.actorType,
    actorUserId: input.actorUserId ?? null,
    actorAgentRunId: input.actorAgentRunId ?? null,
    organizationId: input.organizationId ?? null,
    projectId: input.projectId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    before: toAuditJson(input.before),
    after: toAuditJson(input.after),
    metadata: toAuditJson(input.metadata),
    requestId: input.requestId ?? null,
    prevHash: last?.hash ?? null,
  };
  const hash = computeAuditHash(event);
  const asJson = (v: unknown) => (v === null ? Prisma.DbNull : (v as Prisma.InputJsonValue));

  return tx.auditEvent.create({
    data: {
      ...event,
      actorType: input.actorType,
      before: asJson(event.before),
      after: asJson(event.after),
      metadata: asJson(event.metadata),
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent?.slice(0, 500) ?? null,
      hash,
    },
  });
}

export interface AuditChainVerification {
  ok: boolean;
  eventsChecked: number;
  firstInvalidSequence: string | null;
  reason: string | null;
}

/** Recomputes every hash in sequence order and checks linkage. */
export async function verifyAuditChain(
  prisma: PrismaClient,
  batchSize = 500,
): Promise<AuditChainVerification> {
  let prevHash: string | null = null;
  let cursor: bigint | null = null;
  let checked = 0;
  for (;;) {
    const batch: AuditEvent[] = await prisma.auditEvent.findMany({
      where: cursor === null ? {} : { sequence: { gt: cursor } },
      orderBy: { sequence: "asc" },
      take: batchSize,
    });
    if (batch.length === 0) break;
    for (const e of batch) {
      if (e.prevHash !== prevHash) {
        return {
          ok: false,
          eventsChecked: checked,
          firstInvalidSequence: e.sequence.toString(),
          reason: "broken_link",
        };
      }
      if (computeAuditHash(e) !== e.hash) {
        return {
          ok: false,
          eventsChecked: checked,
          firstInvalidSequence: e.sequence.toString(),
          reason: "hash_mismatch",
        };
      }
      prevHash = e.hash;
      checked += 1;
      cursor = e.sequence;
    }
  }
  return { ok: true, eventsChecked: checked, firstInvalidSequence: null, reason: null };
}
