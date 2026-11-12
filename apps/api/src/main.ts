import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { buildOpenApiDocument, configureApp } from "./bootstrap";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const env = configureApp(app);
  if (env.API_DOCS_ENABLED) {
    SwaggerModule.setup("docs", app, buildOpenApiDocument(app), {
      jsonDocumentUrl: "docs/openapi.json",
    });
  }
  await app.listen(env.PORT);
}

void bootstrap();
