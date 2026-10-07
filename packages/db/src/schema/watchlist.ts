import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  pgView,
  real,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { createdAt, timestamptz } from "./columns";
import { baseUnit, offerSource } from "./enums";
import { offers } from "./retail";

/** A product a user wants the cheapest price for, e.g. "Rød Aalborg". */
export const trackedItems = pgTable(
  "tracked_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Exactly what the user typed. */
    searchTerm: text("search_term").notNull(),
    /** Trimmed, lower-cased, single-spaced; prevents the same item being tracked twice. */
    normalizedTerm: text("normalized_term")
      .notNull()
      .generatedAlwaysAs(
        sql`lower(regexp_replace(btrim("search_term"), '[[:space:]]+', ' ', 'g'))`,
      ),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("tracked_items_user_term_key").on(t.userId, t.normalizedTerm),
    check(
      "tracked_items_search_term_length",
      sql`char_length(btrim(${t.searchTerm})) between 2 and 100`,
    ),
  ],
);

/** Links a tracked item to an offer the scanner judged to be the same product. */
export const priceMatches = pgTable(
  "price_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trackedItemId: uuid("tracked_item_id")
      .notNull()
      .references(() => trackedItems.id, { onDelete: "cascade" }),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),
    /** Matcher confidence from 0 to 1. */
    score: real("score").notNull(),
    matchedAt: timestamptz("matched_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("price_matches_item_offer_key").on(t.trackedItemId, t.offerId),
    index("price_matches_offer_id_idx").on(t.offerId),
    check("price_matches_score_range", sql`${t.score} between 0 and 1`),
  ],
);

/**
 * A price match joined with its offer, in the shape the dashboard reads.
 * `is_current` and `is_future_flyer` are evaluated at query time so they never go stale.
 */
export const priceMatchDetails = pgView("price_match_details", {
  id: uuid("id").notNull(),
  trackedItemId: uuid("tracked_item_id").notNull(),
  offerId: uuid("offer_id").notNull(),
  retailerSlug: text("retailer_slug").notNull(),
  retailerName: text("retailer_name").notNull(),
  storeName: text("store_name").notNull(),
  title: text("title").notNull(),
  priceOre: integer("price_ore").notNull(),
  unitPriceOre: integer("unit_price_ore"),
  baseUnit: baseUnit("base_unit"),
  source: offerSource("source").notNull(),
  validFrom: timestamptz("valid_from").notNull(),
  validTo: timestamptz("valid_to"),
  isCurrent: boolean("is_current").notNull(),
  isFutureFlyer: boolean("is_future_flyer").notNull(),
  score: real("score").notNull(),
  sourceUrl: text("source_url"),
}).as(sql`
  select
    pm.id,
    pm.tracked_item_id,
    o.id as offer_id,
    r.slug as retailer_slug,
    r.name as retailer_name,
    coalesce(s.name, r.name) as store_name,
    o.title,
    o.price_ore,
    o.unit_price_ore,
    o.base_unit,
    o.source,
    o.valid_from,
    o.valid_to,
    (o.valid_from <= now() and (o.valid_to is null or o.valid_to > now())) as is_current,
    (o.source = 'flyer' and o.valid_from > now()) as is_future_flyer,
    pm.score,
    o.source_url
  from price_matches pm
  join offers o on o.id = pm.offer_id
  join retailers r on r.id = o.retailer_id
  left join stores s on s.id = o.store_id
`);
