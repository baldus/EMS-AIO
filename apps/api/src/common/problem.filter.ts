import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { ThrottlerException } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { ProblemException, type ProblemFieldError } from "./problem";

const TITLES: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  413: "Payload Too Large",
  422: "Unprocessable Content",
  429: "Too Many Requests",
  500: "Internal Server Error",
};

const DEFAULT_CODES: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  422: "UNPROCESSABLE",
  429: "RATE_LIMITED",
  500: "INTERNAL_ERROR",
};

/** Renders every error as application/problem+json. Internal details are never leaked. */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { id?: string }>();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = DEFAULT_CODES[500]!;
    let detail = "An unexpected error occurred.";
    let errors: readonly ProblemFieldError[] | undefined;

    if (exception instanceof ProblemException) {
      status = exception.getStatus();
      code = exception.code;
      detail = exception.detail;
      errors = exception.errors;
    } else if (exception instanceof ThrottlerException) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      code = DEFAULT_CODES[429]!;
      detail = "Too many requests. Slow down and retry later.";
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = DEFAULT_CODES[status] ?? "HTTP_ERROR";
      const body = exception.getResponse();
      if (typeof body === "object" && body !== null && "message" in body) {
        const message = (body as { message: unknown }).message;
        if (Array.isArray(message)) {
          detail = "Request validation failed.";
          code = "VALIDATION_FAILED";
          errors = message.map((m) => ({ code: "INVALID", message: String(m) }));
        } else {
          detail = String(message);
        }
      } else {
        detail = exception.message;
      }
    } else {
      this.logger.error({ err: exception, requestId: req.id }, "Unhandled exception");
    }

    res
      .status(status)
      .type("application/problem+json")
      .json({
        type: `https://errors.ems.local/${code.toLowerCase().replace(/_/g, "-")}`,
        title: TITLES[status] ?? "Error",
        status,
        code,
        detail,
        ...(errors && errors.length > 0 ? { errors } : {}),
        instance: req.originalUrl,
        requestId: req.id,
      });
  }
}
