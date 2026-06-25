-- Cronograma de conteúdo por período + copy estruturado nos posts
ALTER TABLE planning_periods
  ADD COLUMN IF NOT EXISTS content_schedule jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE planned_posts
  ADD COLUMN IF NOT EXISTS structured_copy jsonb,
  ADD COLUMN IF NOT EXISTS caption_from_schedule boolean NOT NULL DEFAULT false;
