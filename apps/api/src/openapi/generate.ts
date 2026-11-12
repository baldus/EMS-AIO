/**
 * Writes the OpenAPI contract to packages/api-client/openapi.json without starting a server or
 * connecting to any external system. The committed contract is checked for drift in tests.
 */
import "reflect-metadata";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "../app.module";
import { buildOpenApiDocument, configureApp } from "../bootstrap";
import { OPENAPI_GENERATION_ENV } from "./openapi-env";

async function main() {
  Object.assign(process.env, OPENAPI_GENERATION_ENV);
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
  configureApp(app);
  const doc = buildOpenApiDocument(app);
  const out = path.resolve(__dirname, "../../../../packages/api-client/openapi.json");
  writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`);
  await app.close();
  console.log(`Wrote ${out}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
