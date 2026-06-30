ALTER TABLE planning_periods
  ADD COLUMN IF NOT EXISTS content_schedule_options jsonb NOT NULL DEFAULT '{"postCount":9,"storyCount":12,"extraInstructions":""}'::jsonb;
