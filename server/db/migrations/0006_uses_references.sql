ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS default_uses_references boolean NOT NULL DEFAULT true;

ALTER TABLE planning_periods
  ADD COLUMN IF NOT EXISTS uses_references boolean;
