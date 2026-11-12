import { createHash } from "node:crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import { canonicalJson } from "@ems/domain";
import { Prisma, toAuditJson } from "@ems/db";
import { ProblemException } from "../common/problem";
import { PrismaService } from "../prisma/prisma.service";

const KEY_PATTERN = /^[A-Za-z0-9_.:-]{8,200}$/;
const TTL_MS = 24 * 60 * 60 * 1000;

export interface IdempotentResult<T> {
  status: number;
  body: T;
  replayed: boolean;
}

/**
 * Executes a mutation at most once per (user, Idempotency-Key). The mutation and the stored
 * response commit in the same transaction, so a crash can never leave one without the other.
 * Concurrent duplicates lose the unique-key race, roll back, and replay the winner's response.
 */
@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async run<T>(
    params: {
      userId: string;
      key: string | undefined;
      operation: string;
      request: unknown;
      status: number;
    },
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<IdempotentResult<T>> {
    if (params.key === undefined) {
      const body = await this.prisma.$transaction(work);
      return { status: params.status, body, replayed: false };
    }
    if (!KEY_PATTERN.test(params.key)) {
      throw new ProblemException(
        HttpStatus.BAD_REQUEST,
        "INVALID_IDEMPOTENCY_KEY",
        "Idempotency-Key must be 8-200 characters of [A-Za-z0-9_.:-].",
      );
    }
    const requestHash = createHash("sha256")
      .update(canonicalJson({ op: params.operation, body: toAuditJson(params.request) }))
      .digest("hex");

    const replay = await this.findReplay<T>(
      params.userId,
      params.key,
      params.operation,
      requestHash,
    );
    if (replay) return replay;

    try {
      const body = await this.prisma.$transaction(async (tx) => {
        const result = await work(tx);
        await tx.idempotencyKey.create({
          data: {
            userId: params.userId,
            key: params.key!,
            operation: params.operation,
            requestHash,
            responseStatus: params.status,
            responseBody: toAuditJson(result) as Prisma.InputJsonValue,
            expiresAt: new Date(Date.now() + TTL_MS),
          },
        });
        return result;
      });
      return { status: params.status, body, replayed: false };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const winner = await this.findReplay<T>(
          params.userId,
          params.key,
          params.operation,
          requestHash,
        );
        if (winner) return winner;
      }
      throw err;
    }
  }

  private async findReplay<T>(
    userId: string,
    key: string,
    operation: string,
    requestHash: string,
  ): Promise<IdempotentResult<T> | null> {
    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { userId_key: { userId, key } },
    });
    if (!existing) return null;
    if (existing.expiresAt.getTime() < Date.now()) {
      await this.prisma.idempotencyKey.deleteMany({
        where: { userId, key, expiresAt: { lt: new Date() } },
      });
      return null;
    }
    if (existing.operation !== operation || existing.requestHash !== requestHash) {
      throw new ProblemException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        "IDEMPOTENCY_KEY_REUSED",
        "This Idempotency-Key was already used with a different request.",
      );
    }
    return { status: existing.responseStatus, body: existing.responseBody as T, replayed: true };
  }
}
