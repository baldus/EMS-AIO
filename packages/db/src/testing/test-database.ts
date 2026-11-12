import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * Connection used only to CREATE/DROP ephemeral per-run test databases. The role needs CREATEDB.
 * Local default matches infra/docker-compose.yml (development-only credentials).
 */
export const DEFAULT_TEST_DATABASE_URL =
  "postgresql://ems:ems_local_dev_only@localhost:5432/ems_test?schema=public";

const EPHEMERAL_PREFIX = "ems_test_run_";
const EPHEMERAL_NAME = /^ems_test_run_[a-f0-9]{12}$/;

function baseUrl(): URL {
  return new URL(process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL);
}

export interface EphemeralDatabase {
  name: string;
  url: string;
}

/**
 * Creates a brand-new, uniquely named database and applies all migrations with the
 * non-destructive `prisma migrate deploy`. Never resets or drops any existing database.
 */
export async function createEphemeralTestDatabase(): Promise<EphemeralDatabase> {
  const name = `${EPHEMERAL_PREFIX}${randomBytes(6).toString("hex")}`;
  const admin = new PrismaClient({ datasourceUrl: baseUrl().toString() });
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.$disconnect();
  }
  const url = baseUrl();
  url.pathname = `/${name}`;

  const packageDir = path.resolve(__dirname, "..", "..");
  const prismaCli = require.resolve("prisma/build/index.js", { paths: [packageDir] });
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: packageDir,
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: "pipe",
  });
  return { name, url: url.toString() };
}

/** Drops a database previously created by createEphemeralTestDatabase (name-checked). */
export async function dropEphemeralTestDatabase(db: EphemeralDatabase): Promise<void> {
  if (!EPHEMERAL_NAME.test(db.name)) {
    throw new Error(`Refusing to drop '${db.name}': not an ephemeral test database.`);
  }
  const admin = new PrismaClient({ datasourceUrl: baseUrl().toString() });
  try {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${db.name}" WITH (FORCE)`);
  } finally {
    await admin.$disconnect();
  }
}
