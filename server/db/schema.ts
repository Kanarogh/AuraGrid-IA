import {
  bigint,
  boolean,
  char,
  date,
  index,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("refresh_tokens_user_id_idx").on(t.userId)]
);

export const userAiPreferences = pgTable("user_ai_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  geminiModel: text("gemini_model"),
  geminiCatalogModel: text("gemini_catalog_model"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userAppearancePreferences = pgTable("user_appearance_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  accentId: text("accent_id").notNull().default("cobalto"),
  customAccentLight: text("custom_accent_light"),
  customAccentDark: text("custom_accent_dark"),
  theme: text("theme").notNull().default("light"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clientAiPreferences = pgTable(
  "client_ai_preferences",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    indexingModel: text("indexing_model"),
    planningModel: text("planning_model"),
    contentScheduleModel: text("content_schedule_model"),
    referenceModel: text("reference_model"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.clientId] }),
    index("client_ai_preferences_user_id_idx").on(t.userId),
    index("client_ai_preferences_client_id_idx").on(t.clientId),
  ]
);

export const planningPeriods = pgTable(
  "planning_periods",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references((): AnyPgColumn => clients.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    startDate: date("start_date").notNull(),
    status: text("status").notNull().default("active"),
    campaignContext: text("campaign_context").notNull().default(""),
    usesReferences: boolean("uses_references"),
    contentSchedule: jsonb("content_schedule").notNull().default([]),
    contentScheduleBrief: text("content_schedule_brief").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    index("planning_periods_client_id_idx").on(t.clientId),
    index("planning_periods_client_status_idx").on(t.clientId, t.status),
  ]
);

export const clients = pgTable(
  "clients",
  {
    id: text("id").primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    instagramHandle: text("instagram_handle"),
    startDate: date("start_date").notNull(),
    activePlanningPeriodId: text("active_planning_period_id").references(
      (): AnyPgColumn => planningPeriods.id,
      { onDelete: "set null" }
    ),
    defaultUsesReferences: boolean("default_uses_references").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("clients_owner_user_id_idx").on(t.ownerUserId),
    index("clients_owner_active_idx").on(t.ownerUserId, t.deletedAt),
  ]
);

export const userClientState = pgTable("user_client_state", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  activeClientId: text("active_client_id").references(() => clients.id, {
    onDelete: "set null",
  }),
});

export const brandGems = pgTable("brand_gems", {
  clientId: text("client_id")
    .primaryKey()
    .references(() => clients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  instructions: text("instructions").notNull().default(""),
  campaignContext: text("campaign_context").notNull().default(""),
  captionParams: jsonb("caption_params").notNull().default({}),
  footer: jsonb("footer").notNull().default({}),
  savedAt: timestamp("saved_at", { withTimezone: true }),
});

export const clientUiPrefs = pgTable(
  "client_ui_prefs",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    activeSection: text("active_section"),
    activePreviewId: text("active_preview_id"),
    viewMode: text("view_mode"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.clientId] })]
);

export const enrichJobs = pgTable(
  "enrich_jobs",
  {
    clientId: text("client_id")
      .primaryKey()
      .references(() => clients.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    itemIds: jsonb("item_ids"),
    status: text("status").notNull().default("idle"),
    progress: jsonb("progress"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("enrich_jobs_status_idx").on(t.status)]
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bucket: text("bucket").notNull().default("auragrid-media"),
    objectKey: text("object_key").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    width: smallint("width"),
    height: smallint("height"),
    sha256: text("sha256"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("media_assets_bucket_object_key").on(t.bucket, t.objectKey),
    index("media_assets_client_id_idx").on(t.clientId),
  ]
);

export const catalogItems = pgTable(
  "catalog_items",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    planningPeriodId: text("planning_period_id").references(() => planningPeriods.id, {
      onDelete: "cascade",
    }),
    label: text("label").notNull(),
    description: text("description"),
    isReference: boolean("is_reference").notNull().default(true),
    imageAssetId: uuid("image_asset_id").references(() => mediaAssets.id, {
      onDelete: "set null",
    }),
    visualProfile: jsonb("visual_profile"),
    enrichmentStatus: text("enrichment_status").notNull().default("pending"),
    enrichedAt: timestamp("enriched_at", { withTimezone: true }),
    enrichmentError: text("enrichment_error"),
    sortOrder: smallint("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("catalog_items_client_id_idx").on(t.clientId),
    index("catalog_items_client_status_idx").on(t.clientId, t.enrichmentStatus),
    index("catalog_items_planning_period_id_idx").on(t.planningPeriodId),
  ]
);

export const canvaSettings = pgTable("canva_settings", {
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  planningPeriodId: text("planning_period_id")
    .primaryKey()
    .references(() => planningPeriods.id, { onDelete: "cascade" }),
  activePageId: text("active_page_id").notNull(),
  autoSync: boolean("auto_sync").notNull().default(true),
  reversed: boolean("reversed").notNull().default(true),
  gridFormat: text("grid_format").notNull().default("square"),
  gridMaxWidth: smallint("grid_max_width").notNull().default(480),
});

export const canvaPages = pgTable(
  "canva_pages",
  {
    id: text("id").notNull(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    planningPeriodId: text("planning_period_id")
      .notNull()
      .references(() => planningPeriods.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: smallint("sort_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.planningPeriodId, t.id] })]
);

export const canvaSlots = pgTable(
  "canva_slots",
  {
    id: text("id").notNull(),
    clientId: text("client_id").notNull(),
    planningPeriodId: text("planning_period_id")
      .notNull()
      .references(() => planningPeriods.id, { onDelete: "cascade" }),
    pageId: text("page_id").notNull(),
    slotIndex: smallint("slot_index").notNull(),
    label: text("label"),
    matchedCatalogId: text("matched_catalog_id").references(() => catalogItems.id, {
      onDelete: "set null",
    }),
    imageAssetId: uuid("image_asset_id").references(() => mediaAssets.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    primaryKey({ columns: [t.planningPeriodId, t.id] }),
    unique("canva_slots_period_page_slot_idx").on(t.planningPeriodId, t.pageId, t.slotIndex),
  ]
);

export const plannedPosts = pgTable(
  "planned_posts",
  {
    id: text("id").notNull(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    planningPeriodId: text("planning_period_id")
      .notNull()
      .references(() => planningPeriods.id, { onDelete: "cascade" }),
    dayNumber: smallint("day_number").notNull(),
    dateLabel: text("date_label").notNull(),
    imageAssetId: uuid("image_asset_id").references(() => mediaAssets.id, {
      onDelete: "set null",
    }),
    canvaSlotId: text("canva_slot_id"),
    matchedCatalogId: text("matched_catalog_id").references(() => catalogItems.id, {
      onDelete: "set null",
    }),
    reasoning: text("reasoning"),
    caption: text("caption").notNull().default(""),
    isGenerated: boolean("is_generated").notNull().default(false),
    isConfirmed: boolean("is_confirmed").notNull().default(false),
    captionFromImageOnly: boolean("caption_from_image_only").notNull().default(false),
    structuredCopy: jsonb("structured_copy"),
    captionFromSchedule: boolean("caption_from_schedule").notNull().default(false),
    captionModel: text("caption_model"),
    lastError: text("last_error"),
  },
  (t) => [primaryKey({ columns: [t.planningPeriodId, t.id] })]
);

export const captionCacheEntries = pgTable(
  "caption_cache_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    cacheKey: char("cache_key", { length: 64 }).notNull(),
    caption: text("caption").notNull(),
    matchedCatalogId: text("matched_catalog_id"),
    reasoning: text("reasoning"),
    providerUsed: text("provider_used"),
    matchMode: text("match_mode"),
    cachedAt: timestamp("cached_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("caption_cache_client_key_idx").on(t.clientId, t.cacheKey),
    index("caption_cache_client_id_idx").on(t.clientId),
  ]
);

export const aiUsageEvents = pgTable(
  "ai_usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
    operation: text("operation").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    inputTokens: bigint("input_tokens", { mode: "number" }).notNull().default(0),
    outputTokens: bigint("output_tokens", { mode: "number" }).notNull().default(0),
    totalTokens: bigint("total_tokens", { mode: "number" }).notNull().default(0),
    estimatedCostMicros: bigint("estimated_cost_micros", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ai_usage_events_client_date_idx").on(t.clientId, t.createdAt),
    index("ai_usage_events_user_date_idx").on(t.userId, t.createdAt),
    index("ai_usage_events_model_date_idx").on(t.model, t.createdAt),
  ]
);

export const aiUsageLimits = pgTable(
  "ai_usage_limits",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    model: text("model").notNull().default("*"),
    window: text("window").notNull().default("rolling_30d"),
    tokenLimit: bigint("token_limit", { mode: "number" }),
    costLimitMicros: bigint("cost_limit_micros", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.clientId, t.model, t.window] })]
);

export const clientMetaConnections = pgTable("client_meta_connections", {
  clientId: text("client_id")
    .primaryKey()
    .references(() => clients.id, { onDelete: "cascade" }),
  connectedByUserId: uuid("connected_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  igUserId: text("ig_user_id").notNull(),
  igUsername: text("ig_username"),
  facebookPageId: text("facebook_page_id").notNull(),
  pageName: text("page_name"),
  accessTokenEnc: text("access_token_enc").notNull(),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  scopes: text("scopes"),
  status: text("status").notNull().default("active"),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clientPublishPrefs = pgTable("client_publish_prefs", {
  clientId: text("client_id")
    .primaryKey()
    .references(() => clients.id, { onDelete: "cascade" }),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  slotTemplates: jsonb("slot_templates")
    .notNull()
    .default({
      "1": ["10:00"],
      "2": ["10:00", "18:00"],
      "3": ["09:00", "14:00", "19:00"],
      "4": ["09:00", "12:00", "16:00", "19:00"],
      "5": ["09:00", "11:30", "14:00", "17:00", "19:30"],
    }),
  defaultLeadMinutes: smallint("default_lead_minutes").notNull().default(15),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const instagramPublishJobs = pgTable(
  "instagram_publish_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    planningPeriodId: text("planning_period_id")
      .notNull()
      .references(() => planningPeriods.id, { onDelete: "cascade" }),
    plannedPostId: text("planned_post_id").notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    caption: text("caption").notNull().default(""),
    imageAssetId: uuid("image_asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("queued"),
    attempts: smallint("attempts").notNull().default(0),
    lastError: text("last_error"),
    metaContainerId: text("meta_container_id"),
    metaMediaId: text("meta_media_id"),
    permalink: text("permalink"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("instagram_publish_jobs_status_scheduled_idx").on(t.status, t.scheduledAt),
    index("instagram_publish_jobs_client_period_idx").on(t.clientId, t.planningPeriodId),
  ]
);

