ALTER TABLE "files"
  ADD COLUMN IF NOT EXISTS "project_stage" "project_stage" DEFAULT '实施阶段' NOT NULL,
  ADD COLUMN IF NOT EXISTS "sales_file_tag" text;

CREATE INDEX IF NOT EXISTS "idx_files_project_stage"
  ON "files" ("project_stage");
