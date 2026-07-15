-- Keep retrieval candidates in the database and let pgvector perform an ANN
-- top-K scan before the application applies its visibility policy.
CREATE INDEX IF NOT EXISTS "idx_file_chunks_embedding_hnsw"
  ON "file_chunks" USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 128)
  WHERE "embedding" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_files_search_visible"
  ON "files" ("department_id", "project_id", "project_stage", "created_at" DESC)
  WHERE "deleted_at" IS NULL AND "is_latest" = true;

CREATE INDEX IF NOT EXISTS "idx_project_members_file_visibility"
  ON "project_members" ("user_id", "project_id", "project_stage")
  WHERE "is_active" = true AND "deleted_at" IS NULL;
