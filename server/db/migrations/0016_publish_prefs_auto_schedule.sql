ALTER TABLE "client_publish_prefs"
  ADD COLUMN IF NOT EXISTS "auto_schedule_on_drop" boolean NOT NULL DEFAULT false;
