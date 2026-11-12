import { ValidationPipe, VersioningType } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { ProblemDetailsFilter } from "./common/problem.filter";
import { ProblemDto } from "./common/dto";
import { ENV, type Env } from "./config/env";

/** Applies cross-cutting HTTP configuration. Shared by main.ts, tests, and OpenAPI export. */
export function configureApp(app: NestExpressApplication): Env {
  const env = app.get<Env>(ENV);
  app.useLogger(app.get(Logger));
  app.disable("x-powered-by");
  app.use(helmet());
  app.enableCors({
    origin: env.CORS_ORIGINS,
    credentials: false,
    allowedHeaders: ["Authorization", "Content-Type", "Idempotency-Key", "X-Request-Id"],
    exposedHeaders: ["Idempotent-Replayed", "X-Request-Id"],
  });
  app.useBodyParser("json", { limit: "256kb" });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.enableShutdownHooks();
  return env;
}

export function buildOpenApiDocument(app: NestExpressApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("EMS Platform API")
    .setDescription(
      "API for the EMS industrial project management platform. All errors are RFC 9457 " +
        "problem details (application/problem+json). Authenticate with an OIDC access token.",
    )
    .setVersion("0.1.0")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" })
    .build();
  return SwaggerModule.createDocument(app, config, {
    operationIdFactory: (_controllerKey, methodKey) => methodKey,
    extraModels: [ProblemDto],
  });
}
