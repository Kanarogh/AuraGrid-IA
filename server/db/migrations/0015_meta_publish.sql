CREATE TABLE IF NOT EXISTS "client_meta_connections" (
  "client_id" text PRIMARY KEY NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "connected_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "ig_user_id" text NOT NULL,
  "ig_username" text,
  "facebook_page_id" text NOT NULL,
  "page_name" text,
  "access_token_enc" text NOT NULL,
  "token_expires_at" timestamptz,
  "scopes" text,
  "status" text NOT NULL DEFAULT 'active',
  "connected_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "client_publish_prefs" (
  "client_id" text PRIMARY KEY NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "timezone" text NOT NULL DEFAULT 'America/Sao_Paulo',
  "slot_templates" jsonb NOT NULL DEFAULT '{"1":["10:00"],"2":["10:00","18:00"],"3":["09:00","14:00","19:00"],"4":["09:00","12:00","16:00","19:00"],"5":["09:00","11:30","14:00","17:00","19:30"]}'::jsonb,
  "default_lead_minutes" smallint NOT NULL DEFAULT 15,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "instagram_publish_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" text NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "planning_period_id" text NOT NULL REFERENCES "planning_periods"("id") ON DELETE CASCADE,
  "planned_post_id" text NOT NULL,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "scheduled_at" timestamptz NOT NULL,
  "caption" text NOT NULL DEFAULT '',
  "image_asset_id" uuid NOT NULL REFERENCES "media_assets"("id") ON DELETE RESTRICT,
  "status" text NOT NULL DEFAULT 'queued',
  "attempts" smallint NOT NULL DEFAULT 0,
  "last_error" text,
  "meta_container_id" text,
  "meta_media_id" text,
  "permalink" text,
  "published_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "instagram_publish_jobs_status_scheduled_idx"
  ON "instagram_publish_jobs" ("status", "scheduled_at");

CREATE INDEX IF NOT EXISTS "instagram_publish_jobs_client_period_idx"
  ON "instagram_publish_jobs" ("client_id", "planning_period_id");

CREATE UNIQUE INDEX IF NOT EXISTS "instagram_publish_jobs_active_post_idx"
  ON "instagram_publish_jobs" ("planning_period_id", "planned_post_id")
  WHERE "status" IN ('queued', 'publishing');
