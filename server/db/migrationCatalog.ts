/** Migrations SQL aplicadas em ordem pelo runner (`migrate.ts` / boot). */
export const MIGRATION_FILES = [
  "0000_initial",
  "0001_campaign_context",
  "0002_planned_posts_multi",
  "0003_catalog_embeddings",
  "0004_user_ai_preferences_models",
  "0005_planning_periods",
  "0006_uses_references",
  "0007_content_schedule",
  "0008_gemini_only_ai_preferences",
  "0009_client_ai_preferences",
  "0010_planned_posts_caption_model",
  "0011_ai_usage_tracking",
  "0012_content_schedule_brief",
  "0013_enrich_jobs",
  "0014_user_appearance_preferences",
  "0015_meta_publish",
] as const;

export type MigrationHash = (typeof MIGRATION_FILES)[number];

