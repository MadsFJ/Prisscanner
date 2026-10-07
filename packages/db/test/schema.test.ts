import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  offers,
  priceMatchDetails,
  priceMatches,
  retailers,
  stores,
  trackedItems,
  users,
} from "../src/schema";
import { seedRetailers } from "../src/seed";
import { retailerSeed } from "../src/seed-data";
import {
  connectTestDb,
  createOffer,
  createTrackedItem,
  createUser,
  daysFromNow,
  expectConstraintViolation,
  getRetailerId,
} from "./helpers";

const db = connectTestDb();
let retailerId: string;

beforeAll(async () => {
  retailerId = await getRetailerId(db);
});

afterAll(async () => {
  await db.$client.end();
});

describe("migrations", () => {
  it("creates every table and the price match view", async () => {
    const result = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    );
    expect(result.rows.map((r) => r.table_name)).toEqual([
      "accounts",
      "offers",
      "postal_codes",
      "price_match_details",
      "price_matches",
      "retailers",
      "scrape_runs",
      "sessions",
      "stores",
      "tracked_items",
      "users",
      "verifications",
    ]);
  });

  it("enables pg_trgm for fuzzy matching", async () => {
    const result = await db.execute<{ extname: string }>(
      sql`select extname from pg_extension where extname = 'pg_trgm'`,
    );
    expect(result.rows).toHaveLength(1);
  });
});

describe("users", () => {
  it("rejects postal codes that are not four digits", async () => {
    await expectConstraintViolation(
      createUser(db, { postalCode: "80O0" }),
      "users_postal_code_format",
    );
  });

  it("rejects emails that are not lower case", async () => {
    await expectConstraintViolation(
      createUser(db, { email: "Mads@Example.dk" }),
      "users_email_lowercase",
    );
  });

  it("deletes a user's tracked items and price matches with the user", async () => {
    const user = await createUser(db);
    const item = await createTrackedItem(db, user.id);
    const offer = await createOffer(db, retailerId);
    await db.insert(priceMatches).values({ trackedItemId: item.id, offerId: offer.id, score: 0.9 });

    await db.delete(users).where(eq(users.id, user.id));

    expect(await db.select().from(trackedItems).where(eq(trackedItems.userId, user.id))).toEqual(
      [],
    );
    expect(
      await db.select().from(priceMatches).where(eq(priceMatches.trackedItemId, item.id)),
    ).toEqual([]);
    // Offers are shared between users and must survive.
    expect(await db.select().from(offers).where(eq(offers.id, offer.id))).toHaveLength(1);
  });
});

describe("tracked items", () => {
  it("normalises the search term", async () => {
    const user = await createUser(db);
    const item = await createTrackedItem(db, user.id, "  Rød   Aalborg ");
    expect(item.searchTerm).toBe("  Rød   Aalborg ");
    expect(item.normalizedTerm).toBe("rød aalborg");
  });

  it("stops a user tracking the same item twice, ignoring case and spacing", async () => {
    const user = await createUser(db);
    await createTrackedItem(db, user.id, "Rød Aalborg");
    await expectConstraintViolation(
      createTrackedItem(db, user.id, " RØD  aalborg"),
      "tracked_items_user_term_key",
    );
  });

  it("lets different users track the same item", async () => {
    const first = await createUser(db);
    const second = await createUser(db);
    await createTrackedItem(db, first.id, "Rød Aalborg");
    await expect(createTrackedItem(db, second.id, "Rød Aalborg")).resolves.toBeDefined();
  });

  it("rejects search terms shorter than two characters", async () => {
    const user = await createUser(db);
    await expectConstraintViolation(
      createTrackedItem(db, user.id, "  a "),
      "tracked_items_search_term_length",
    );
  });
});

describe("offers", () => {
  it("rejects a non-positive price", async () => {
    await expectConstraintViolation(
      createOffer(db, retailerId, { priceOre: 0 }),
      "offers_price_positive",
    );
  });

  it("requires flyer offers to have an end date", async () => {
    await expectConstraintViolation(
      createOffer(db, retailerId, { source: "flyer", validTo: null }),
      "offers_flyer_has_end",
    );
  });

  it("allows open-ended webshop prices", async () => {
    const offer = await createOffer(db, retailerId, { source: "webshop", validTo: null });
    expect(offer.validTo).toBeNull();
  });

  it("requires the end date to be after the start date", async () => {
    await expectConstraintViolation(
      createOffer(db, retailerId, { validFrom: daysFromNow(2), validTo: daysFromNow(1) }),
      "offers_validity_order",
    );
  });

  it("requires a unit whenever a pack size is given", async () => {
    await expectConstraintViolation(
      createOffer(db, retailerId, { packSize: 0.7, baseUnit: null }),
      "offers_pack_size_has_unit",
    );
  });

  it("returns pack size as a number", async () => {
    const offer = await createOffer(db, retailerId, {
      packSize: 0.7,
      baseUnit: "l",
      unitPriceOre: 21421,
    });
    expect(offer.packSize).toBe(0.7);
  });

  it("finds offers with Danish full-text search regardless of word order and case", async () => {
    const offer = await createOffer(db, retailerId, { title: "AALBORG RØD AKVAVIT 45% 70 CL" });
    const hits = await db
      .select({ id: offers.id })
      .from(offers)
      .where(
        and(
          eq(offers.id, offer.id),
          sql`${offers.searchVector} @@ plainto_tsquery('danish', 'rød aalborg')`,
        ),
      );
    expect(hits).toEqual([{ id: offer.id }]);
  });
});

describe("price_match_details view", () => {
  it("flags current, upcoming and expired offers at query time", async () => {
    const user = await createUser(db);
    const item = await createTrackedItem(db, user.id);
    const [store] = await db
      .insert(stores)
      .values({ retailerId, externalId: "test-1", name: "Netto Vesterbrogade", postalCode: "1620" })
      .returning();

    const current = await createOffer(db, retailerId, {
      validFrom: daysFromNow(-1),
      validTo: daysFromNow(3),
    });
    const upcoming = await createOffer(db, retailerId, {
      validFrom: daysFromNow(4),
      validTo: daysFromNow(11),
    });
    const expired = await createOffer(db, retailerId, {
      validFrom: daysFromNow(-10),
      validTo: daysFromNow(-3),
    });
    const webshop = await createOffer(db, retailerId, {
      source: "webshop",
      storeId: store?.id,
      validFrom: daysFromNow(-30),
      validTo: null,
    });

    await db.insert(priceMatches).values(
      [current, upcoming, expired, webshop].map((offer) => ({
        trackedItemId: item.id,
        offerId: offer.id,
        score: 0.95,
      })),
    );

    const rows = await db
      .select()
      .from(priceMatchDetails)
      .where(eq(priceMatchDetails.trackedItemId, item.id));
    const byOffer = new Map(rows.map((row) => [row.offerId, row]));

    expect(byOffer.get(current.id)).toMatchObject({ isCurrent: true, isFutureFlyer: false });
    expect(byOffer.get(upcoming.id)).toMatchObject({ isCurrent: false, isFutureFlyer: true });
    expect(byOffer.get(expired.id)).toMatchObject({ isCurrent: false, isFutureFlyer: false });
    expect(byOffer.get(webshop.id)).toMatchObject({ isCurrent: true, isFutureFlyer: false });

    expect(byOffer.get(current.id)).toMatchObject({
      storeName: "Netto",
      retailerSlug: "netto",
      priceOre: 14995,
    });
    expect(byOffer.get(webshop.id)?.storeName).toBe("Netto Vesterbrogade");
    expect(byOffer.get(upcoming.id)?.validFrom).toBeInstanceOf(Date);
  });
});

describe("seeding", () => {
  it("can run repeatedly without duplicating retailers", async () => {
    await seedRetailers(db);
    await seedRetailers(db);
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(retailers);
    expect(result[0]?.count).toBe(retailerSeed.length);
  });
});
