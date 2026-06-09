CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "password_hash" text NOT NULL,
  "display_name" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE IF NOT EXISTS "refresh_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_ai_preferences" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "active_provider" text,
  "openrouter_model" text,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "clients" (
  "id" text PRIMARY KEY NOT NULL,
  "owner_user_id" uuid NOT NULL,
  "name" text NOT NULL,
  "instagram_handle" text,
  "start_date" date NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz
);

CREATE TABLE IF NOT EXISTS "user_client_state" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "active_client_id" text
);

CREATE TABLE IF NOT EXISTS "brand_gems" (
  "client_id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "instructions" text DEFAULT '' NOT NULL,
  "campaign_context" text DEFAULT '' NOT NULL,
  "caption_params" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "footer" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "saved_at" timestamptz
);

CREATE TABLE IF NOT EXISTS "client_ui_prefs" (
  "user_id" uuid NOT NULL,
  "client_id" text NOT NULL,
  "active_section" text,
  "active_preview_id" text,
  "view_mode" text,
  CONSTRAINT "client_ui_prefs_user_id_client_id_pk" PRIMARY KEY("user_id","client_id")
);

CREATE TABLE IF NOT EXISTS "media_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" text NOT NULL,
  "uploaded_by" uuid NOT NULL,
  "bucket" text DEFAULT 'auragrid-media' NOT NULL,
  "object_key" text NOT NULL,
  "mime_type" text NOT NULL,
  "byte_size" bigint NOT NULL,
  "width" smallint,
  "height" smallint,
  "sha256" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "media_assets_bucket_object_key" UNIQUE("bucket","object_key")
);

CREATE TABLE IF NOT EXISTS "catalog_items" (
  "id" text PRIMARY KEY NOT NULL,
  "client_id" text NOT NULL,
  "label" text NOT NULL,
  "description" text,
  "is_reference" boolean DEFAULT true NOT NULL,
  "image_asset_id" uuid,
  "visual_profile" jsonb,
  "enrichment_status" text DEFAULT 'pending' NOT NULL,
  "enriched_at" timestamptz,
  "enrichment_error" text,
  "sort_order" smallint DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "canva_settings" (
  "client_id" text PRIMARY KEY NOT NULL,
  "active_page_id" text NOT NULL,
  "auto_sync" boolean DEFAULT true NOT NULL,
  "reversed" boolean DEFAULT true NOT NULL,
  "grid_format" text DEFAULT 'square' NOT NULL,
  "grid_max_width" smallint DEFAULT 480 NOT NULL
);

CREATE TABLE IF NOT EXISTS "canva_pages" (
  "id" text NOT NULL,
  "client_id" text NOT NULL,
  "name" text NOT NULL,
  "sort_order" smallint DEFAULT 0 NOT NULL,
  CONSTRAINT "canva_pages_client_id_id_pk" PRIMARY KEY("client_id","id")
);

CREATE TABLE IF NOT EXISTS "canva_slots" (
  "id" text NOT NULL,
  "client_id" text NOT NULL,
  "page_id" text NOT NULL,
  "slot_index" smallint NOT NULL,
  "label" text,
  "matched_catalog_id" text,
  "image_asset_id" uuid,
  CONSTRAINT "canva_slots_client_id_id_pk" PRIMARY KEY("client_id","id"),
  CONSTRAINT "canva_slots_page_slot_idx" UNIQUE("client_id","page_id","slot_index")
);

CREATE TABLE IF NOT EXISTS "planned_posts" (
  "id" text NOT NULL,
  "client_id" text NOT NULL,
  "day_number" smallint NOT NULL,
  "date_label" text NOT NULL,
  "image_asset_id" uuid,
  "canva_slot_id" text,
  "matched_catalog_id" text,
  "reasoning" text,
  "caption" text DEFAULT '' NOT NULL,
  "is_generated" boolean DEFAULT false NOT NULL,
  "is_confirmed" boolean DEFAULT false NOT NULL,
  "caption_from_image_only" boolean DEFAULT false NOT NULL,
  "last_error" text,
  CONSTRAINT "planned_posts_client_id_id_pk" PRIMARY KEY("client_id","id"),
  CONSTRAINT "planned_posts_client_day_idx" UNIQUE("client_id","day_number")
);

CREATE TABLE IF NOT EXISTS "caption_cache_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" text NOT NULL,
  "cache_key" char(64) NOT NULL,
  "caption" text NOT NULL,
  "matched_catalog_id" text,
  "reasoning" text,
  "provider_used" text,
  "match_mode" text,
  "cached_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "caption_cache_client_key_idx" UNIQUE("client_id","cache_key")
);

ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_ai_preferences" ADD CONSTRAINT "user_ai_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "clients" ADD CONSTRAINT "clients_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_client_state" ADD CONSTRAINT "user_client_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_client_state" ADD CONSTRAINT "user_client_state_active_client_id_clients_id_fk" FOREIGN KEY ("active_client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "brand_gems" ADD CONSTRAINT "brand_gems_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "client_ui_prefs" ADD CONSTRAINT "client_ui_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "client_ui_prefs" ADD CONSTRAINT "client_ui_prefs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_image_asset_id_media_assets_id_fk" FOREIGN KEY ("image_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "canva_settings" ADD CONSTRAINT "canva_settings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "canva_pages" ADD CONSTRAINT "canva_pages_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "canva_slots" ADD CONSTRAINT "canva_slots_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "canva_slots" ADD CONSTRAINT "canva_slots_page_fk" FOREIGN KEY ("client_id","page_id") REFERENCES "public"."canva_pages"("client_id","id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "canva_slots" ADD CONSTRAINT "canva_slots_matched_catalog_id_catalog_items_id_fk" FOREIGN KEY ("matched_catalog_id") REFERENCES "public"."catalog_items"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "canva_slots" ADD CONSTRAINT "canva_slots_image_asset_id_media_assets_id_fk" FOREIGN KEY ("image_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "planned_posts" ADD CONSTRAINT "planned_posts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "planned_posts" ADD CONSTRAINT "planned_posts_image_asset_id_media_assets_id_fk" FOREIGN KEY ("image_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "planned_posts" ADD CONSTRAINT "planned_posts_matched_catalog_id_catalog_items_id_fk" FOREIGN KEY ("matched_catalog_id") REFERENCES "public"."catalog_items"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "caption_cache_entries" ADD CONSTRAINT "caption_cache_entries_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_idx" ON "refresh_tokens" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "clients_owner_user_id_idx" ON "clients" USING btree ("owner_user_id");
CREATE INDEX IF NOT EXISTS "clients_owner_active_idx" ON "clients" USING btree ("owner_user_id","deleted_at");
CREATE INDEX IF NOT EXISTS "media_assets_client_id_idx" ON "media_assets" USING btree ("client_id");
CREATE INDEX IF NOT EXISTS "catalog_items_client_id_idx" ON "catalog_items" USING btree ("client_id");
CREATE INDEX IF NOT EXISTS "catalog_items_client_status_idx" ON "catalog_items" USING btree ("client_id","enrichment_status");
CREATE INDEX IF NOT EXISTS "caption_cache_client_id_idx" ON "caption_cache_entries" USING btree ("client_id");
