-- Permite vários posts no mesmo dia (ex.: 2–3 fotos no Dia 1 após sync do Canva).
ALTER TABLE "planned_posts" DROP CONSTRAINT IF EXISTS "planned_posts_client_day_idx";
