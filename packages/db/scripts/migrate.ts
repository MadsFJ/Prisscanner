import { createDb } from "../src/client";
import { runMigrations } from "../src/migrate";
import { requireEnv } from "./env";

const db = createDb(requireEnv("DATABASE_URL"));
try {
  await runMigrations(db);
  console.log("Migrations applied.");
} finally {
  await db.$client.end();
}
