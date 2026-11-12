import type { TestProject } from "vitest/node";
import {
  createEphemeralTestDatabase,
  dropEphemeralTestDatabase,
} from "../src/testing/test-database";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

export default async function setup(project: TestProject) {
  const db = await createEphemeralTestDatabase();
  project.provide("databaseUrl", db.url);
  return async () => {
    await dropEphemeralTestDatabase(db);
  };
}
