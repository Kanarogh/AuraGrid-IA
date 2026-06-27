CREATE TABLE IF NOT EXISTS "user_appearance_preferences" (
  "user_id" uuid PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "accent_id" text NOT NULL DEFAULT 'cobalto',
  "custom_accent_light" text,
  "custom_accent_dark" text,
  "theme" text NOT NULL DEFAULT 'light',
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
