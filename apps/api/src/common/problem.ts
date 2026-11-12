import { HttpException, HttpStatus } from "@nestjs/common";

export interface ProblemFieldError {
  field?: string;
  code: string;
  message: string;
}

/**
 * Application error rendered as RFC 9457 problem details. `code` is a stable machine-readable
 * identifier clients may branch on.
 */
export class ProblemException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: string,
    readonly detail: string,
    readonly errors?: readonly ProblemFieldError[],
  ) {
    super({ code, detail, errors }, status);
  }
}

export const notFound = (entity: string) =>
  new ProblemException(HttpStatus.NOT_FOUND, "NOT_FOUND", `${entity} not found.`);

export const forbidden = (code: string, detail: string) =>
  new ProblemException(HttpStatus.FORBIDDEN, code, detail);

export const versionConflict = () =>
  new ProblemException(
    HttpStatus.CONFLICT,
    "VERSION_CONFLICT",
    "The record was modified by someone else. Reload and try again.",
  );

export const ruleViolation = (errors: readonly { code: string; message: string }[]) =>
  new ProblemException(
    HttpStatus.UNPROCESSABLE_ENTITY,
    "BUSINESS_RULE_VIOLATION",
    "The request violates a business rule.",
    errors.map((e) => ({ code: e.code, message: e.message })),
  );
