import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Where an offer was scraped from.
 * - `flyer`:   a weekly tilbudsavis with a fixed validity window (may start in the future).
 * - `webshop`: a retailer's online shelf price, valid from when it was first seen until it changes.
 */
export const offerSource = pgEnum("offer_source", ["flyer", "webshop"]);

/** Unit used to compare prices across pack sizes (kr/l, kr/kg, kr/stk). */
export const baseUnit = pgEnum("base_unit", ["l", "kg", "stk"]);

export const scrapeStatus = pgEnum("scrape_status", ["running", "succeeded", "failed"]);
