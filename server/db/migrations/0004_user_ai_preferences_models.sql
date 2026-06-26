ALTER TABLE "user_ai_preferences" ADD COLUMN IF NOT EXISTS "gemini_model" text;
ALTER TABLE "user_ai_preferences" ADD COLUMN IF NOT EXISTS "gemini_catalog_model" text;
