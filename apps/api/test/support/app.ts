import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Type } from "@nestjs/common";
import { PrismaClient, seedDatabase } from "@ems/db";
import { AppModule } from "../../src/app.module";
import { configureApp } from "../../src/bootstrap";
import { ENV, parseEnv } from "../../src/config/env";
import { JWKS_RESOLVER } from "../../src/auth/token-verifier.service";
import { TEST_AUDIENCE, TEST_ISSUER, TestIdentityProvider } from "./tokens";

export interface TestContext {
  app: NestExpressApplication;
  prisma: PrismaClient;
  idp: TestIdentityProvider;
  close: () => Promise<void>;
}

/** Boots the real application against an ephemeral database seeded with fictional data. */
export async function createTestContext(
  databaseUrl: string,
  extraControllers: Type<unknown>[] = [],
): Promise<TestContext> {
  const idp = await TestIdentityProvider.create();
  const env = parseEnv({
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    DATABASE_URL: databaseUrl,
    OIDC_ISSUER_URL: TEST_ISSUER,
    OIDC_AUDIENCE: TEST_AUDIENCE,
    AUTH_MFA_AMR_VALUES: "mfa,otp,hwk",
    AUTH_EMAIL_LINKING_ENABLED: "true",
    API_DOCS_ENABLED: "false",
  });

  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  await seedDatabase(prisma);

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: extraControllers,
  })
    .overrideProvider(ENV)
    .useValue(env)
    .overrideProvider(JWKS_RESOLVER)
    .useValue(async () => idp.jwks)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ bufferLogs: true });
  configureApp(app);
  await app.init();

  return {
    app,
    prisma,
    idp,
    close: async () => {
      await app.close();
      await prisma.$disconnect();
    },
  };
}

export const USERS = {
  admin: "admin@ems.example.com",
  manager: "manager@ems.example.com",
  pm: "pm@ems.example.com",
  finance: "finance@ems.example.com",
  harborLead: "lead@harborpoint.example.com",
  harborEngineer: "engineer@harborpoint.example.com",
  copperlineBuyer: "buyer@copperline.example.com",
} as const;
