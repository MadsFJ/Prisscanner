import { relations } from "drizzle-orm";
import { accounts, sessions, users } from "./auth";
import { offers, retailers, scrapeRuns, stores } from "./retail";
import { priceMatches, trackedItems } from "./watchlist";

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  trackedItems: many(trackedItems),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const retailersRelations = relations(retailers, ({ many }) => ({
  stores: many(stores),
  offers: many(offers),
  scrapeRuns: many(scrapeRuns),
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  retailer: one(retailers, { fields: [stores.retailerId], references: [retailers.id] }),
  offers: many(offers),
}));

export const scrapeRunsRelations = relations(scrapeRuns, ({ one, many }) => ({
  retailer: one(retailers, { fields: [scrapeRuns.retailerId], references: [retailers.id] }),
  offers: many(offers),
}));

export const offersRelations = relations(offers, ({ one, many }) => ({
  retailer: one(retailers, { fields: [offers.retailerId], references: [retailers.id] }),
  store: one(stores, { fields: [offers.storeId], references: [stores.id] }),
  scrapeRun: one(scrapeRuns, { fields: [offers.scrapeRunId], references: [scrapeRuns.id] }),
  priceMatches: many(priceMatches),
}));

export const trackedItemsRelations = relations(trackedItems, ({ one, many }) => ({
  user: one(users, { fields: [trackedItems.userId], references: [users.id] }),
  priceMatches: many(priceMatches),
}));

export const priceMatchesRelations = relations(priceMatches, ({ one }) => ({
  trackedItem: one(trackedItems, {
    fields: [priceMatches.trackedItemId],
    references: [trackedItems.id],
  }),
  offer: one(offers, { fields: [priceMatches.offerId], references: [offers.id] }),
}));
