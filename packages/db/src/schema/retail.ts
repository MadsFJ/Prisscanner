import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  doublePrecision,
  index,
  integer,
  numeric,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, timestamptz, tsvector, updatedAt } from "./columns";
import { baseUnit, offerSource, scrapeStatus } from "./enums";

/** A retail chain we scrape, e.g. Netto or REMA 1000. */
export const retailers = pgTable("retailers", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Stable key that links a row to its scraper implementation. */
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Danish postal codes with a centre point, used to find stores near a user. */
export const postalCodes = pgTable(
  "postal_codes",
  {
    code: char("code", { length: 4 }).primaryKey(),
    name: text("name").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
  },
  (t) => [check("postal_codes_code_format", sql`${t.code} ~ '^[0-9]{4}$'`)],
);

/** A physical store belonging to a retailer. */
export const stores = pgTable(
  "stores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    retailerId: uuid("retailer_id")
      .notNull()
      .references(() => retailers.id, { onDelete: "cascade" }),
    /** The retailer's own identifier for the store. */
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    street: text("street"),
    postalCode: char("postal_code", { length: 4 }).notNull(),
    city: text("city"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("stores_retailer_external_id_key").on(t.retailerId, t.externalId),
    index("stores_postal_code_idx").on(t.postalCode),
  ],
);

/** One execution of a scraper, kept for freshness indicators and debugging. */
export const scrapeRuns = pgTable(
  "scrape_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    retailerId: uuid("retailer_id")
      .notNull()
      .references(() => retailers.id, { onDelete: "cascade" }),
    source: offerSource("source").notNull(),
    status: scrapeStatus("status").notNull().default("running"),
    startedAt: timestamptz("started_at").notNull().defaultNow(),
    finishedAt: timestamptz("finished_at"),
    offersFound: integer("offers_found"),
    error: text("error"),
  },
  (t) => [index("scrape_runs_retailer_started_idx").on(t.retailerId, t.startedAt.desc())],
);

/**
 * A normalised price observation, shared by all users.
 *
 * Prices are integer øre (1 kr = 100 øre). The validity window is half-open:
 * an offer is current when `valid_from <= now() < valid_to`, and `valid_to` is null
 * while a webshop price is still live.
 */
export const offers = pgTable(
  "offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    retailerId: uuid("retailer_id")
      .notNull()
      .references(() => retailers.id, { onDelete: "cascade" }),
    /** Null when the offer applies to the whole chain. */
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    scrapeRunId: uuid("scrape_run_id").references(() => scrapeRuns.id, { onDelete: "set null" }),
    source: offerSource("source").notNull(),
    /** Built by the scanner so re-scraping the same offer updates it instead of duplicating it. */
    dedupeKey: text("dedupe_key").notNull().unique(),
    /** The retailer's own product or offer identifier, when it has one. */
    externalId: text("external_id"),
    title: text("title").notNull(),
    brand: text("brand"),
    description: text("description"),
    priceOre: integer("price_ore").notNull(),
    /** Pack size expressed in `base_unit`, e.g. 0.7 for a 70 cl bottle. */
    packSize: numeric("pack_size", { precision: 12, scale: 3, mode: "number" }),
    baseUnit: baseUnit("base_unit"),
    /** Price per one `base_unit` in øre, for comparing different pack sizes. */
    unitPriceOre: integer("unit_price_ore"),
    validFrom: timestamptz("valid_from").notNull(),
    validTo: timestamptz("valid_to"),
    sourceUrl: text("source_url"),
    imageUrl: text("image_url"),
    searchVector: tsvector("search_vector")
      .notNull()
      .generatedAlwaysAs(
        sql`setweight(to_tsvector('danish', coalesce("brand", '')), 'A') || setweight(to_tsvector('danish', "title"), 'A') || setweight(to_tsvector('danish', coalesce("description", '')), 'C')`,
      ),
    firstSeenAt: timestamptz("first_seen_at").notNull().defaultNow(),
    lastSeenAt: timestamptz("last_seen_at").notNull().defaultNow(),
  },
  (t) => [
    check("offers_price_positive", sql`${t.priceOre} > 0`),
    check("offers_unit_price_positive", sql`${t.unitPriceOre} is null or ${t.unitPriceOre} > 0`),
    check("offers_pack_size_positive", sql`${t.packSize} is null or ${t.packSize} > 0`),
    check("offers_pack_size_has_unit", sql`(${t.packSize} is null) = (${t.baseUnit} is null)`),
    check("offers_validity_order", sql`${t.validTo} is null or ${t.validTo} > ${t.validFrom}`),
    check("offers_flyer_has_end", sql`${t.source} <> 'flyer' or ${t.validTo} is not null`),
    index("offers_search_vector_idx").using("gin", t.searchVector),
    index("offers_title_trgm_idx").using("gin", t.title.op("gin_trgm_ops")),
    index("offers_retailer_valid_to_idx").on(t.retailerId, t.validTo),
  ],
);
