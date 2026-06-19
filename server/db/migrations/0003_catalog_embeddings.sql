-- Metadados de embedding (funcionam sem pgvector)
ALTER TABLE catalog_items
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedded_at timestamptz;

-- pgvector (Neon, Supabase, Docker local). Square Cloud pode não ter a extensão.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_available_extensions WHERE name = 'vector'
  ) THEN
    RAISE NOTICE 'AuraGrid: extensão vector indisponível neste host — embeddings desativados.';
    RETURN;
  END IF;

  BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'AuraGrid: sem permissão para CREATE EXTENSION vector.';
      RETURN;
    WHEN OTHERS THEN
      RAISE NOTICE 'AuraGrid: falha ao criar extensão vector: %', SQLERRM;
      RETURN;
  END;

  ALTER TABLE catalog_items
    ADD COLUMN IF NOT EXISTS image_embedding vector(768);

  CREATE INDEX IF NOT EXISTS catalog_items_image_embedding_hnsw_idx
    ON catalog_items
    USING hnsw (image_embedding vector_cosine_ops)
    WHERE image_embedding IS NOT NULL;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'AuraGrid: coluna/index vector ignorados: %', SQLERRM;
END $$;
