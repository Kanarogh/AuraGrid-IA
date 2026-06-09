ALTER TABLE "brand_gems"
  ADD COLUMN IF NOT EXISTS "campaign_context" text DEFAULT '' NOT NULL;
