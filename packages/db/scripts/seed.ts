import { createDb } from "../src/client";
import { seedRetailers } from "../src/seed";
import { requireEnv } from "./env";

const db = createDb(requireEnv("DATABASE_URL"));
try {
  await seedRetailers(db);
  console.log("Retailers seeded.");
} finally {
  await db.$client.end();
}
