import { Injectable } from "@nestjs/common";
import { appendAuditEvent, verifyAuditChain, type AuditEventInput, type Prisma } from "@ems/db";
import type { RequestMeta } from "../common/request-meta";
import { PrismaService } from "../prisma/prisma.service";

export interface UserAuditInput extends Omit<
  AuditEventInput,
  "actorType" | "actorUserId" | "requestId" | "ipAddress" | "userAgent"
> {
  actorUserId: string;
  meta: RequestMeta;
}

/** Fields never written into audit before/after snapshots. */
const EXCLUDED_FIELDS = new Set(["updatedAt", "version"]);

/** Returns before/after objects containing only fields whose values changed. */
export function diffForAudit<T extends Record<string, unknown>>(
  before: T,
  after: T,
): { before: Partial<T>; after: Partial<T> } {
  const b: Partial<T> = {};
  const a: Partial<T> = {};
  for (const key of Object.keys(after) as (keyof T & string)[]) {
    if (EXCLUDED_FIELDS.has(key)) continue;
    const prev = before[key];
    const next = after[key];
    const same =
      prev instanceof Date && next instanceof Date
        ? prev.getTime() === next.getTime()
        : JSON.stringify(prev) === JSON.stringify(next);
    if (!same) {
      b[key] = prev;
      a[key] = next;
    }
  }
  return { before: b, after: a };
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Records a user action inside the caller's transaction (atomic with the change). */
  recordUserAction(tx: Prisma.TransactionClient, input: UserAuditInput) {
    const { meta, ...rest } = input;
    return appendAuditEvent(tx, {
      ...rest,
      actorType: "user",
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  verifyChain() {
    return verifyAuditChain(this.prisma);
  }
}
