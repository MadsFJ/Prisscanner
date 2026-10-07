import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { expect, inject } from "vitest";
import { createDb } from "../src/client";
import { offers, retailers, trackedItems, users } from "../src/schema";
import { seedRetailers } from "../src/seed";
import type { NewOffer } from "../src/types";

export function connectTestDb() {
  return createDb(inject("databaseUrl"));
}

type TestDb = ReturnType<typeof connectTestDb>;

const DAY_MS = 24 * 60 * 60 * 1000;
export const daysFromNow = (days: number) => new Date(Date.now() + days * DAY_MS);

export async function createUser(db: TestDb, values: Partial<typeof users.$inferInsert> = {}) {
  const id = randomUUID();
  const [user] = await db
    .insert(users)
    .values({ id, name: "Test", email: `${id}@example.dk`, postalCode: "8000", ...values })
    .returning();
  if (!user) throw new Error("user insert returned nothing");
  return user;
}

export async function createTrackedItem(db: TestDb, userId: string, searchTerm = "Rød Aalborg") {
  const [item] = await db.insert(trackedItems).values({ userId, searchTerm }).returning();
  if (!item) throw new Error("tracked item insert returned nothing");
  return item;
}

export async function getRetailerId(db: TestDb, slug = "netto") {
  await seedRetailers(db);
  const [retailer] = await db.select().from(retailers).where(eq(retailers.slug, slug));
  if (!retailer) throw new Error(`retailer ${slug} missing after seeding`);
  return retailer.id;
}

export async function createOffer(db: TestDb, retailerId: string, values: Partial<NewOffer> = {}) {
  const [offer] = await db
    .insert(offers)
    .values({
      retailerId,
      source: "flyer",
      dedupeKey: randomUUID(),
      title: "Aalborg Rød Akvavit 45% 70 cl",
      priceOre: 14995,
      validFrom: daysFromNow(-1),
      validTo: daysFromNow(5),
      ...values,
    })
    .returning();
  if (!offer) throw new Error("offer insert returned nothing");
  return offer;
}

/** Asserts that `promise` fails because the named Postgres constraint was violated. */
export async function expectConstraintViolation(promise: Promise<unknown>, constraint: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error, `expected "${constraint}" to be violated`).not.toBeNull();
  // Drizzle wraps driver errors; the pg error with the constraint name is the cause.
  const pgError = (error as { cause?: unknown }).cause ?? error;
  expect((pgError as { constraint?: string }).constraint).toBe(constraint);
}
