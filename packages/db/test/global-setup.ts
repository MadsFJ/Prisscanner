import { randomBytes } from "node:crypto";
import pg from "pg";
import type { TestProject } from "vitest/node";
import { requireEnv } from "../scripts/env";
import { createDb } from "../src/client";
import { runMigrations } from "../src/migrate";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/** Creates a throwaway database, applies all migrations to it, and drops it afterwards. */
export default async function setup(project: TestProject) {
  const adminUrl = requireEnv("TEST_DATABASE_ADMIN_URL");
  const dbName = `prisscanner_test_${randomBytes(4).toString("hex")}`;

  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`create database "${dbName}"`);

  const url = new URL(adminUrl);
  url.pathname = `/${dbName}`;
  const databaseUrl = url.toString();

  const db = createDb(databaseUrl);
  try {
    await runMigrations(db);
  } finally {
    await db.$client.end();
  }

  project.provide("databaseUrl", databaseUrl);

  return async () => {
    await admin.query(`drop database if exists "${dbName}" with (force)`);
    await admin.end();
  };
}
