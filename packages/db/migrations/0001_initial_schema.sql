CREATE TYPE "public"."base_unit" AS ENUM('l', 'kg', 'stk');--> statement-breakpoint
CREATE TYPE "public"."offer_source" AS ENUM('flyer', 'webshop');--> statement-breakpoint
CREATE TYPE "public"."scrape_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"postal_code" char(4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_email_lowercase" CHECK ("users"."email" = lower("users"."email")),
	CONSTRAINT "users_postal_code_format" CHECK ("users"."postal_code" ~ '^[0-9]{4}$')
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"retailer_id" uuid NOT NULL,
	"store_id" uuid,
	"scrape_run_id" uuid,
	"source" "offer_source" NOT NULL,
	"dedupe_key" text NOT NULL,
	"external_id" text,
	"title" text NOT NULL,
	"brand" text,
	"description" text,
	"price_ore" integer NOT NULL,
	"pack_size" numeric(12, 3),
	"base_unit" "base_unit",
	"unit_price_ore" integer,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone,
	"source_url" text,
	"image_url" text,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('danish', coalesce("brand", '')), 'A') || setweight(to_tsvector('danish', "title"), 'A') || setweight(to_tsvector('danish', coalesce("description", '')), 'C')) STORED NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offers_dedupe_key_unique" UNIQUE("dedupe_key"),
	CONSTRAINT "offers_price_positive" CHECK ("offers"."price_ore" > 0),
	CONSTRAINT "offers_unit_price_positive" CHECK ("offers"."unit_price_ore" is null or "offers"."unit_price_ore" > 0),
	CONSTRAINT "offers_pack_size_positive" CHECK ("offers"."pack_size" is null or "offers"."pack_size" > 0),
	CONSTRAINT "offers_pack_size_has_unit" CHECK (("offers"."pack_size" is null) = ("offers"."base_unit" is null)),
	CONSTRAINT "offers_validity_order" CHECK ("offers"."valid_to" is null or "offers"."valid_to" > "offers"."valid_from"),
	CONSTRAINT "offers_flyer_has_end" CHECK ("offers"."source" <> 'flyer' or "offers"."valid_to" is not null)
);
--> statement-breakpoint
CREATE TABLE "postal_codes" (
	"code" char(4) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	CONSTRAINT "postal_codes_code_format" CHECK ("postal_codes"."code" ~ '^[0-9]{4}$')
);
--> statement-breakpoint
CREATE TABLE "retailers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "retailers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "scrape_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"retailer_id" uuid NOT NULL,
	"source" "offer_source" NOT NULL,
	"status" "scrape_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"offers_found" integer,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"retailer_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"street" text,
	"postal_code" char(4) NOT NULL,
	"city" text,
	"latitude" double precision,
	"longitude" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stores_retailer_external_id_key" UNIQUE("retailer_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "price_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tracked_item_id" uuid NOT NULL,
	"offer_id" uuid NOT NULL,
	"score" real NOT NULL,
	"matched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_matches_score_range" CHECK ("price_matches"."score" between 0 and 1)
);
--> statement-breakpoint
CREATE TABLE "tracked_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"search_term" text NOT NULL,
	"normalized_term" text GENERATED ALWAYS AS (lower(regexp_replace(btrim("search_term"), '[[:space:]]+', ' ', 'g'))) STORED NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracked_items_search_term_length" CHECK (char_length(btrim("tracked_items"."search_term")) between 2 and 100)
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_retailer_id_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."retailers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_scrape_run_id_scrape_runs_id_fk" FOREIGN KEY ("scrape_run_id") REFERENCES "public"."scrape_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrape_runs" ADD CONSTRAINT "scrape_runs_retailer_id_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."retailers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_retailer_id_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."retailers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_matches" ADD CONSTRAINT "price_matches_tracked_item_id_tracked_items_id_fk" FOREIGN KEY ("tracked_item_id") REFERENCES "public"."tracked_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_matches" ADD CONSTRAINT "price_matches_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracked_items" ADD CONSTRAINT "tracked_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "offers_search_vector_idx" ON "offers" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "offers_title_trgm_idx" ON "offers" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "offers_retailer_valid_to_idx" ON "offers" USING btree ("retailer_id","valid_to");--> statement-breakpoint
CREATE INDEX "scrape_runs_retailer_started_idx" ON "scrape_runs" USING btree ("retailer_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "stores_postal_code_idx" ON "stores" USING btree ("postal_code");--> statement-breakpoint
CREATE UNIQUE INDEX "price_matches_item_offer_key" ON "price_matches" USING btree ("tracked_item_id","offer_id");--> statement-breakpoint
CREATE INDEX "price_matches_offer_id_idx" ON "price_matches" USING btree ("offer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tracked_items_user_term_key" ON "tracked_items" USING btree ("user_id","normalized_term");--> statement-breakpoint
CREATE VIEW "public"."price_match_details" AS (
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
);