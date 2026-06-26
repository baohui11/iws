CREATE EXTENSION IF NOT EXISTS pgmq;--> statement-breakpoint
CREATE TYPE "public"."file_pipeline_status" AS ENUM('pending', 'processing', 'ready', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."file_process_stage" AS ENUM('preview', 'parse', 'index');--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('pgmq.q_file_processing') IS NULL THEN
    PERFORM pgmq.create('file_processing');
  END IF;
END $$;--> statement-breakpoint

TRUNCATE TABLE "file_process_tasks";--> statement-breakpoint

ALTER TABLE "files" ALTER COLUMN "preview_status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "files" ALTER COLUMN "preview_status" TYPE "file_pipeline_status" USING (
  CASE "preview_status"::text
    WHEN 'success' THEN 'ready'
    WHEN 'failure' THEN 'failed'
    WHEN 'processing' THEN 'processing'
    ELSE 'pending'
  END
)::"file_pipeline_status";--> statement-breakpoint
ALTER TABLE "files" ALTER COLUMN "preview_status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "files" ALTER COLUMN "preview_status" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "files" ADD COLUMN "preview_error" text;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "parsed_storage_key" text;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "parse_status" "file_pipeline_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "parse_error" text;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "index_status" "file_pipeline_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "index_error" text;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "processing_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN IF EXISTS "extract_status";--> statement-breakpoint

ALTER TABLE "file_process_tasks" DROP CONSTRAINT IF EXISTS "file_process_tasks_fileId_taskType_unique";--> statement-breakpoint
ALTER TABLE "file_process_tasks" DROP COLUMN IF EXISTS "task_type";--> statement-breakpoint
ALTER TABLE "file_process_tasks" ADD COLUMN "stage" "file_process_stage" NOT NULL;--> statement-breakpoint
ALTER TABLE "file_process_tasks" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "file_process_tasks" ALTER COLUMN "status" TYPE "file_pipeline_status" USING (
  CASE "status"::text
    WHEN 'success' THEN 'ready'
    WHEN 'failure' THEN 'failed'
    WHEN 'processing' THEN 'processing'
    ELSE 'pending'
  END
)::"file_pipeline_status";--> statement-breakpoint
ALTER TABLE "file_process_tasks" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "file_process_tasks" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "file_process_tasks" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "file_process_tasks" ADD COLUMN "max_attempts" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "file_process_tasks" ADD COLUMN "priority" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "file_process_tasks" ADD COLUMN "run_after" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "file_process_tasks" ADD COLUMN "locked_by" text;--> statement-breakpoint
ALTER TABLE "file_process_tasks" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "file_process_tasks" ADD COLUMN "input" jsonb;--> statement-breakpoint
ALTER TABLE "file_process_tasks" ADD COLUMN "output" jsonb;--> statement-breakpoint
ALTER TABLE "file_process_tasks" DROP COLUMN IF EXISTS "result_data";--> statement-breakpoint
ALTER TABLE "file_process_tasks" ADD COLUMN "error_code" text;--> statement-breakpoint
ALTER TABLE "file_process_tasks" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "file_process_tasks" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "file_process_tasks" ADD COLUMN "pgmq_message_id" bigint;--> statement-breakpoint

ALTER TABLE "file_process_tasks" ADD CONSTRAINT "file_process_tasks_file_id_stage_unique" UNIQUE("file_id","stage");--> statement-breakpoint
ALTER TABLE "file_process_tasks" ADD CONSTRAINT "chk_file_process_tasks_attempts" CHECK ("attempts" >= 0);--> statement-breakpoint
ALTER TABLE "file_process_tasks" ADD CONSTRAINT "chk_file_process_tasks_max_attempts" CHECK ("max_attempts" > 0);--> statement-breakpoint
CREATE INDEX "idx_file_process_tasks_pick" ON "file_process_tasks" USING btree ("status","run_after","priority","created_at");--> statement-breakpoint
CREATE INDEX "idx_file_process_tasks_file" ON "file_process_tasks" USING btree ("file_id");--> statement-breakpoint

DROP TYPE IF EXISTS "public"."file_preview_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."file_process_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."file_process_task_type";--> statement-breakpoint
