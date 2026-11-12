import { randomUUID } from "node:crypto";
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import type { IncomingMessage } from "node:http";
import { AuditController } from "./audit/audit.controller";
import { AuditService } from "./audit/audit.service";
import { AuthGuard } from "./auth/auth.guard";
import { PrincipalService } from "./auth/principal.service";
import {
  JWKS_RESOLVER,
  remoteJwksResolverFactory,
  TokenVerifierService,
} from "./auth/token-verifier.service";
import { AuthorizationService } from "./authorization/authorization.service";
import { resolveRequestId } from "./common/request-meta";
import { ConfigModule } from "./config/config.module";
import { ENV, type Env } from "./config/env";
import { DashboardController } from "./dashboard/dashboard.controller";
import { HealthController } from "./health/health.controller";
import { IdempotencyService } from "./idempotency/idempotency.service";
import { MeController } from "./me/me.controller";
import { OrganizationsController } from "./organizations/organizations.controller";
import { OrganizationsService } from "./organizations/organizations.service";
import { PrismaService } from "./prisma/prisma.service";
import { ProjectsController, ProjectsService } from "./projects/projects";

/**
 * Modular monolith root. Release 0 keeps modules as folders with explicit providers; each will
 * become its own Nest module as it grows (see docs/architecture/overview.md).
 */
@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ENV],
      useFactory: (env: Env) => ({
        pinoHttp: {
          level: env.LOG_LEVEL,
          genReqId: (req: IncomingMessage) =>
            resolveRequestId(req.headers["x-request-id"], randomUUID),
          customProps: () => ({ service: "ems-api" }),
          redact: {
            paths: ["req.headers.authorization", "req.headers.cookie", 'res.headers["set-cookie"]'],
            censor: "[REDACTED]",
          },
          autoLogging: {
            ignore: (req: IncomingMessage) => req.url?.startsWith("/health") ?? false,
          },
          transport:
            env.NODE_ENV === "development"
              ? { target: "pino-pretty", options: { singleLine: true } }
              : undefined,
        },
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
  ],
  controllers: [
    HealthController,
    MeController,
    DashboardController,
    OrganizationsController,
    ProjectsController,
    AuditController,
  ],
  providers: [
    {
      provide: JWKS_RESOLVER,
      inject: [ENV],
      useFactory: (env: Env) => remoteJwksResolverFactory(env),
    },
    PrismaService,
    TokenVerifierService,
    PrincipalService,
    AuthorizationService,
    AuditService,
    IdempotencyService,
    OrganizationsService,
    ProjectsService,
    // Order matters: rate limiting first, then authentication + default-deny authorization.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
