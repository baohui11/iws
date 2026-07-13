CREATE EXTENSION IF NOT EXISTS vector;

ALTER TYPE "file_process_stage" ADD VALUE IF NOT EXISTS 'embed';

ALTER TABLE "files"
  ADD COLUMN IF NOT EXISTS "department_id" uuid,
  ADD COLUMN IF NOT EXISTS "original_file_name" text,
  ADD COLUMN IF NOT EXISTS "file_hash" text,
  ADD COLUMN IF NOT EXISTS "business_type" text,
  ADD COLUMN IF NOT EXISTS "embedding_status" "file_pipeline_status" DEFAULT 'pending' NOT NULL,
  ADD COLUMN IF NOT EXISTS "embedding_error" text,
  ADD COLUMN IF NOT EXISTS "embedding_model" text,
  ADD COLUMN IF NOT EXISTS "embedding_dim" integer,
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;

ALTER TABLE "files"
  ADD CONSTRAINT "files_department_id_departments_id_fk"
  FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id")
  ON DELETE set null ON UPDATE no action;

UPDATE "files" f
SET "department_id" = p."department_id"
FROM "projects" p
WHERE f."project_id" = p."id"
  AND f."department_id" IS NULL;

UPDATE "files"
SET "business_type" = CASE
  WHEN "project_stage" = '销售阶段' THEN 'sales_file'
  WHEN "is_deliverable" = true THEN 'deliverable'
  ELSE 'reference'
END
WHERE "business_type" IS NULL;

UPDATE "files"
SET "original_file_name" = "file_name"
WHERE "original_file_name" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_files_department"
  ON "files" ("department_id");

CREATE INDEX IF NOT EXISTS "idx_files_business_type"
  ON "files" ("business_type");

CREATE INDEX IF NOT EXISTS "idx_files_embedding_status"
  ON "files" ("embedding_status");

CREATE INDEX IF NOT EXISTS "idx_files_deleted_at"
  ON "files" ("deleted_at");

CREATE TABLE IF NOT EXISTS "file_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "file_id" uuid NOT NULL,
  "content_text" text,
  "content_hash" text,
  "parser_name" text,
  "parser_version" text,
  "language" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "file_documents_file_id_unique" UNIQUE("file_id")
);

ALTER TABLE "file_documents"
  ADD CONSTRAINT "file_documents_file_id_files_id_fk"
  FOREIGN KEY ("file_id") REFERENCES "public"."files"("id")
  ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "idx_file_documents_file"
  ON "file_documents" ("file_id");

CREATE TABLE IF NOT EXISTS "file_chunks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "file_id" uuid NOT NULL,
  "document_id" uuid NOT NULL,
  "chunk_index" integer NOT NULL,
  "content" text NOT NULL,
  "content_hash" text,
  "page_no" integer,
  "slide_no" integer,
  "sheet_name" text,
  "row_start" integer,
  "row_end" integer,
  "section_title" text,
  "metadata" jsonb,
  "search_vector" tsvector,
  "embedding" vector(1536),
  "embedding_model" text,
  "embedding_dim" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "file_chunks_file_chunk_unique" UNIQUE("file_id","chunk_index")
);

ALTER TABLE "file_chunks"
  ADD CONSTRAINT "file_chunks_file_id_files_id_fk"
  FOREIGN KEY ("file_id") REFERENCES "public"."files"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "file_chunks"
  ADD CONSTRAINT "file_chunks_document_id_file_documents_id_fk"
  FOREIGN KEY ("document_id") REFERENCES "public"."file_documents"("id")
  ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "idx_file_chunks_file"
  ON "file_chunks" ("file_id");

CREATE INDEX IF NOT EXISTS "idx_file_chunks_document"
  ON "file_chunks" ("document_id");

CREATE INDEX IF NOT EXISTS "idx_file_chunks_search_vector"
  ON "file_chunks" USING gin ("search_vector");

CREATE INDEX IF NOT EXISTS "idx_file_chunks_embedding"
  ON "file_chunks" USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);
