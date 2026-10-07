import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type {
  offers,
  priceMatchDetails,
  priceMatches,
  retailers,
  scrapeRuns,
  stores,
  trackedItems,
  users,
} from "./schema";

export type User = InferSelectModel<typeof users>;
export type Retailer = InferSelectModel<typeof retailers>;
export type Store = InferSelectModel<typeof stores>;
export type ScrapeRun = InferSelectModel<typeof scrapeRuns>;
export type Offer = InferSelectModel<typeof offers>;
export type NewOffer = InferInsertModel<typeof offers>;
export type TrackedItem = InferSelectModel<typeof trackedItems>;
export type NewTrackedItem = InferInsertModel<typeof trackedItems>;
export type PriceMatch = InferSelectModel<typeof priceMatches>;
export type PriceMatchDetail = typeof priceMatchDetails.$inferSelect;
