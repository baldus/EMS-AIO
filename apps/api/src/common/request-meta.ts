import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

/** Request metadata captured into audit events. */
export interface RequestMeta {
  requestId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export function requestMetaFrom(req: Request & { id?: unknown }): RequestMeta {
  return {
    requestId: typeof req.id === "string" ? req.id : null,
    ipAddress: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  };
}

export const ReqMeta = createParamDecorator((_: unknown, ctx: ExecutionContext): RequestMeta =>
  requestMetaFrom(ctx.switchToHttp().getRequest()),
);

const REQUEST_ID = /^[A-Za-z0-9._:-]{8,100}$/;

/** Accepts a well-formed inbound X-Request-Id, otherwise generates one. */
export function resolveRequestId(header: string | string[] | undefined, generate: () => string) {
  const value = Array.isArray(header) ? header[0] : header;
  return value && REQUEST_ID.test(value) ? value : generate();
}
