import { sql } from "drizzle-orm";
import type { Database } from "./client";
import { retailers } from "./schema";
import { retailerSeed } from "./seed-data";

/** Inserts or renames the known retailers. Safe to run repeatedly. */
export async function seedRetailers(db: Database) {
  await db
    .insert(retailers)
    .values([...retailerSeed])
    .onConflictDoUpdate({ target: retailers.slug, set: { name: sql`excluded.name` } });
}
