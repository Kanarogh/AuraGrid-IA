-- Briefing do cronograma de conteúdo por roteiro
ALTER TABLE planning_periods
  ADD COLUMN IF NOT EXISTS content_schedule_brief text NOT NULL DEFAULT '';
