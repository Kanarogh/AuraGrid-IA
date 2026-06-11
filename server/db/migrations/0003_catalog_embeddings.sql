CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE catalog_items
  ADD COLUMN IF NOT EXISTS image_embedding vector(768),
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedded_at timestamptz;

CREATE INDEX IF NOT EXISTS catalog_items_image_embedding_hnsw_idx
  ON catalog_items
  USING hnsw (image_embedding vector_cosine_ops)
  WHERE image_embedding IS NOT NULL;
