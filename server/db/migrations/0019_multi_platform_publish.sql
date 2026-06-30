-- Multi-platform publish: platform column on jobs + social connections for LinkedIn/Pinterest

ALTER TABLE instagram_publish_jobs
  ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'instagram';

-- Replace single-post unique with per-platform unique for active jobs
DROP INDEX IF EXISTS instagram_publish_jobs_active_post_idx;
CREATE UNIQUE INDEX IF NOT EXISTS instagram_publish_jobs_active_post_platform_idx
  ON instagram_publish_jobs (planning_period_id, planned_post_id, platform)
  WHERE status IN ('queued', 'publishing');

CREATE INDEX IF NOT EXISTS instagram_publish_jobs_platform_idx
  ON instagram_publish_jobs (client_id, platform, status);

CREATE TABLE IF NOT EXISTS client_social_connections (
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  connected_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT,
  token_expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (client_id, platform)
);

ALTER TABLE client_publish_prefs
  ADD COLUMN IF NOT EXISTS default_platforms JSONB NOT NULL DEFAULT '["instagram"]';

ALTER TABLE client_publish_prefs
  ADD COLUMN IF NOT EXISTS pinterest_default_board_id TEXT;
