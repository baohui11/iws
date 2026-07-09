ALTER TYPE "public"."weekly_report_status" ADD VALUE IF NOT EXISTS 'withdrawn';--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD COLUMN IF NOT EXISTS "project_stage" "project_stage" DEFAULT '实施阶段' NOT NULL;--> statement-breakpoint
ALTER TABLE "weekly_reports" DROP CONSTRAINT IF EXISTS "weekly_reports_userId_projectId_weekCode_unique";--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_user_project_week_stage_unique" UNIQUE("user_id","project_id","week_code","project_stage");
