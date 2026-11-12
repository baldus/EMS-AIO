import { readFileSync } from "node:fs";
import path from "node:path";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { buildOpenApiDocument, configureApp } from "../src/bootstrap";
import { OPENAPI_GENERATION_ENV } from "../src/openapi/openapi-env";

let doc: ReturnType<typeof buildOpenApiDocument>;
let app: NestExpressApplication;

beforeAll(async () => {
  Object.assign(process.env, OPENAPI_GENERATION_ENV);
  app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
  configureApp(app);
  doc = buildOpenApiDocument(app);
});
afterAll(async () => app.close());

describe("OpenAPI contract", () => {
  it("matches the committed contract (run `pnpm openapi:generate` after API changes)", () => {
    const committed = JSON.parse(
      readFileSync(path.resolve(__dirname, "../../../packages/api-client/openapi.json"), "utf8"),
    );
    expect(JSON.parse(JSON.stringify(doc))).toEqual(committed);
  });

  it("requires bearer auth on every non-health operation and has unique operation ids", () => {
    const ids = new Set<string>();
    for (const [route, item] of Object.entries(doc.paths)) {
      for (const [method, op] of Object.entries(
        item as Record<string, { operationId: string; security?: unknown[] }>,
      )) {
        expect(ids.has(op.operationId), `duplicate operationId ${op.operationId}`).toBe(false);
        ids.add(op.operationId);
        if (!route.startsWith("/health")) {
          expect(
            op.security,
            `${method.toUpperCase()} ${route} must declare bearer security`,
          ).toEqual([{ bearer: [] }]);
        }
      }
    }
  });
});
