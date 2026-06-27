-- Fila de enriquecimento persistida (progresso multi-instância / sobrevive restart)
CREATE TABLE IF NOT EXISTS enrich_jobs (
  client_id text PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  item_ids jsonb,
  status text NOT NULL DEFAULT 'idle',
  progress jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enrich_jobs_status_idx ON enrich_jobs (status);
