-- Roteiros mensais (planning periods) com histórico por cliente.
-- Idempotente: seguro reexecutar após falha parcial no deploy.

CREATE TABLE IF NOT EXISTS "planning_periods" (
  "id" text PRIMARY KEY,
  "client_id" text NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "label" text NOT NULL,
  "start_date" date NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "campaign_context" text NOT NULL DEFAULT '',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "archived_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "planning_periods_client_id_idx" ON "planning_periods" ("client_id");
CREATE INDEX IF NOT EXISTS "planning_periods_client_status_idx" ON "planning_periods" ("client_id", "status");

ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "active_planning_period_id" text;

ALTER TABLE "planned_posts" ADD COLUMN IF NOT EXISTS "planning_period_id" text;
ALTER TABLE "canva_pages" ADD COLUMN IF NOT EXISTS "planning_period_id" text;
ALTER TABLE "canva_slots" ADD COLUMN IF NOT EXISTS "planning_period_id" text;
ALTER TABLE "catalog_items" ADD COLUMN IF NOT EXISTS "planning_period_id" text;
ALTER TABLE "canva_settings" ADD COLUMN IF NOT EXISTS "planning_period_id" text;

-- Backfill: um roteiro ativo por cliente existente
INSERT INTO "planning_periods" ("id", "client_id", "label", "start_date", "status", "campaign_context")
SELECT
  c."id" || '__period_default',
  c."id",
  'Roteiro ' || to_char(c."start_date", 'TMMonth YYYY'),
  c."start_date",
  'active',
  COALESCE(bg."campaign_context", '')
FROM "clients" c
LEFT JOIN "brand_gems" bg ON bg."client_id" = c."id"
WHERE NOT EXISTS (
  SELECT 1 FROM "planning_periods" pp WHERE pp."client_id" = c."id"
);

UPDATE "clients" c
SET "active_planning_period_id" = c."id" || '__period_default'
WHERE c."active_planning_period_id" IS NULL;

UPDATE "planned_posts" p
SET "planning_period_id" = p."client_id" || '__period_default'
WHERE p."planning_period_id" IS NULL;

UPDATE "canva_pages" cp
SET "planning_period_id" = cp."client_id" || '__period_default'
WHERE cp."planning_period_id" IS NULL;

UPDATE "canva_slots" cs
SET "planning_period_id" = cs."client_id" || '__period_default'
WHERE cs."planning_period_id" IS NULL;

UPDATE "catalog_items" ci
SET "planning_period_id" = ci."client_id" || '__period_default'
WHERE ci."planning_period_id" IS NULL;

UPDATE "canva_settings" cfg
SET "planning_period_id" = cfg."client_id" || '__period_default'
WHERE cfg."planning_period_id" IS NULL;

-- FK de slots → pages depende da PK antiga de canva_pages; remover antes de trocar PKs
ALTER TABLE "canva_slots" DROP CONSTRAINT IF EXISTS "canva_slots_page_fk";

-- planned_posts
ALTER TABLE "planned_posts" DROP CONSTRAINT IF EXISTS "planned_posts_client_id_id_pk";
ALTER TABLE "planned_posts" DROP CONSTRAINT IF EXISTS "planned_posts_period_id_pk";
ALTER TABLE "planned_posts" DROP CONSTRAINT IF EXISTS "planned_posts_planning_period_fk";
ALTER TABLE "planned_posts" ALTER COLUMN "planning_period_id" SET NOT NULL;
ALTER TABLE "planned_posts" ADD CONSTRAINT "planned_posts_period_id_pk" PRIMARY KEY ("planning_period_id", "id");
ALTER TABLE "planned_posts"
  ADD CONSTRAINT "planned_posts_planning_period_fk"
  FOREIGN KEY ("planning_period_id") REFERENCES "planning_periods"("id") ON DELETE CASCADE;

-- canva_pages
ALTER TABLE "canva_pages" DROP CONSTRAINT IF EXISTS "canva_pages_client_id_id_pk";
ALTER TABLE "canva_pages" DROP CONSTRAINT IF EXISTS "canva_pages_period_id_pk";
ALTER TABLE "canva_pages" DROP CONSTRAINT IF EXISTS "canva_pages_planning_period_fk";
ALTER TABLE "canva_pages" ALTER COLUMN "planning_period_id" SET NOT NULL;
ALTER TABLE "canva_pages" ADD CONSTRAINT "canva_pages_period_id_pk" PRIMARY KEY ("planning_period_id", "id");
ALTER TABLE "canva_pages"
  ADD CONSTRAINT "canva_pages_planning_period_fk"
  FOREIGN KEY ("planning_period_id") REFERENCES "planning_periods"("id") ON DELETE CASCADE;

-- canva_slots
ALTER TABLE "canva_slots" DROP CONSTRAINT IF EXISTS "canva_slots_client_id_id_pk";
ALTER TABLE "canva_slots" DROP CONSTRAINT IF EXISTS "canva_slots_period_id_pk";
ALTER TABLE "canva_slots" DROP CONSTRAINT IF EXISTS "canva_slots_page_slot_idx";
ALTER TABLE "canva_slots" DROP CONSTRAINT IF EXISTS "canva_slots_period_page_slot_idx";
ALTER TABLE "canva_slots" DROP CONSTRAINT IF EXISTS "canva_slots_planning_period_fk";
ALTER TABLE "canva_slots" ALTER COLUMN "planning_period_id" SET NOT NULL;
ALTER TABLE "canva_slots" ADD CONSTRAINT "canva_slots_period_id_pk" PRIMARY KEY ("planning_period_id", "id");
ALTER TABLE "canva_slots"
  ADD CONSTRAINT "canva_slots_planning_period_fk"
  FOREIGN KEY ("planning_period_id") REFERENCES "planning_periods"("id") ON DELETE CASCADE;
ALTER TABLE "canva_slots"
  ADD CONSTRAINT "canva_slots_period_page_slot_idx" UNIQUE ("planning_period_id", "page_id", "slot_index");
ALTER TABLE "canva_slots"
  ADD CONSTRAINT "canva_slots_page_fk"
  FOREIGN KEY ("planning_period_id", "page_id") REFERENCES "canva_pages"("planning_period_id", "id") ON DELETE CASCADE;

-- catalog_items
ALTER TABLE "catalog_items" DROP CONSTRAINT IF EXISTS "catalog_items_planning_period_fk";
ALTER TABLE "catalog_items"
  ADD CONSTRAINT "catalog_items_planning_period_fk"
  FOREIGN KEY ("planning_period_id") REFERENCES "planning_periods"("id") ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "catalog_items_planning_period_id_idx" ON "catalog_items" ("planning_period_id");

-- canva_settings
ALTER TABLE "canva_settings" DROP CONSTRAINT IF EXISTS "canva_settings_pkey";
ALTER TABLE "canva_settings" DROP CONSTRAINT IF EXISTS "canva_settings_planning_period_pk";
ALTER TABLE "canva_settings" DROP CONSTRAINT IF EXISTS "canva_settings_planning_period_fk";
ALTER TABLE "canva_settings" ALTER COLUMN "planning_period_id" SET NOT NULL;
ALTER TABLE "canva_settings" ADD CONSTRAINT "canva_settings_planning_period_pk" PRIMARY KEY ("planning_period_id");
ALTER TABLE "canva_settings"
  ADD CONSTRAINT "canva_settings_planning_period_fk"
  FOREIGN KEY ("planning_period_id") REFERENCES "planning_periods"("id") ON DELETE CASCADE;

-- clients.active_planning_period_id (por último — planning_periods já existe)
ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_active_planning_period_fk";
ALTER TABLE "clients"
  ADD CONSTRAINT "clients_active_planning_period_fk"
  FOREIGN KEY ("active_planning_period_id") REFERENCES "planning_periods"("id") ON DELETE SET NULL;
