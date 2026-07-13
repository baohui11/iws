CREATE EXTENSION IF NOT EXISTS pg_jieba;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

UPDATE "file_chunks"
SET "search_vector" = to_tsvector('jiebacfg', coalesce("content", ''))
WHERE "content" IS NOT NULL;

DROP INDEX IF EXISTS "idx_file_chunks_search_vector";
CREATE INDEX IF NOT EXISTS "idx_file_chunks_search_vector"
  ON "file_chunks" USING gin ("search_vector");

CREATE INDEX IF NOT EXISTS "idx_file_chunks_content_trgm"
  ON "file_chunks" USING gin ("content" gin_trgm_ops);
