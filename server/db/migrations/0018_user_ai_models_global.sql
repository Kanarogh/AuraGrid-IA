ALTER TABLE "user_ai_preferences" ADD COLUMN IF NOT EXISTS "indexing_model" text;
ALTER TABLE "user_ai_preferences" ADD COLUMN IF NOT EXISTS "planning_model" text;
ALTER TABLE "user_ai_preferences" ADD COLUMN IF NOT EXISTS "content_schedule_model" text;
ALTER TABLE "user_ai_preferences" ADD COLUMN IF NOT EXISTS "reference_model" text;

UPDATE "user_ai_preferences"
SET
  "indexing_model" = COALESCE("indexing_model", "gemini_catalog_model"),
  "planning_model" = COALESCE("planning_model", "gemini_model"),
  "content_schedule_model" = COALESCE("content_schedule_model", "gemini_model"),
  "reference_model" = COALESCE("reference_model", "gemini_model");

INSERT INTO "user_ai_preferences" (
  "user_id",
  "gemini_model",
  "gemini_catalog_model",
  "indexing_model",
  "planning_model",
  "content_schedule_model",
  "reference_model",
  "updated_at"
)
SELECT DISTINCT ON ("user_id")
  "user_id",
  "planning_model",
  "indexing_model",
  "indexing_model",
  "planning_model",
  "content_schedule_model",
  "reference_model",
  "updated_at"
FROM "client_ai_preferences"
ORDER BY "user_id", "updated_at" DESC
ON CONFLICT ("user_id") DO UPDATE SET
  "indexing_model" = COALESCE("user_ai_preferences"."indexing_model", EXCLUDED."indexing_model"),
  "planning_model" = COALESCE("user_ai_preferences"."planning_model", EXCLUDED."planning_model"),
  "content_schedule_model" = COALESCE(
    "user_ai_preferences"."content_schedule_model",
    EXCLUDED."content_schedule_model"
  ),
  "reference_model" = COALESCE("user_ai_preferences"."reference_model", EXCLUDED."reference_model"),
  "gemini_model" = COALESCE("user_ai_preferences"."gemini_model", EXCLUDED."gemini_model"),
  "gemini_catalog_model" = COALESCE(
    "user_ai_preferences"."gemini_catalog_model",
    EXCLUDED."gemini_catalog_model"
  ),
  "updated_at" = GREATEST("user_ai_preferences"."updated_at", EXCLUDED."updated_at");
