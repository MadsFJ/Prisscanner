import { customType, timestamp } from "drizzle-orm/pg-core";

/** All timestamps are stored as `timestamptz` and surface as JS `Date`s. */
export const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const createdAt = () => timestamptz("created_at").notNull().defaultNow();

export const updatedAt = () =>
  timestamptz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/** Postgres full-text search vector. Only ever written by a generated column. */
export const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});
