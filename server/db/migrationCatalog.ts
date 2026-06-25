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
] as const;

export type MigrationHash = (typeof MIGRATION_FILES)[number];
