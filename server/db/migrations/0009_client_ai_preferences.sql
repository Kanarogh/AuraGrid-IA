CREATE TABLE IF NOT EXISTS "client_ai_preferences" (
  "user_id" uuid NOT NULL,
  "client_id" text NOT NULL,
  "indexing_model" text,
  "planning_model" text,
  "content_schedule_model" text,
  "reference_model" text,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "client_ai_preferences_user_id_client_id_pk" PRIMARY KEY("user_id","client_id")
);

DO $$ BEGIN
  ALTER TABLE "client_ai_preferences"
    ADD CONSTRAINT "client_ai_preferences_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "client_ai_preferences"
    ADD CONSTRAINT "client_ai_preferences_client_id_clients_id_fk"
    FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "client_ai_preferences_user_id_idx" ON "client_ai_preferences" ("user_id");
CREATE INDEX IF NOT EXISTS "client_ai_preferences_client_id_idx" ON "client_ai_preferences" ("client_id");
