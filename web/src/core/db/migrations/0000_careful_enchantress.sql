CREATE TYPE "public"."file_preview_status" AS ENUM('pending', 'processing', 'success', 'failure');--> statement-breakpoint
CREATE TYPE "public"."file_process_status" AS ENUM('pending', 'processing', 'success', 'failure');--> statement-breakpoint
CREATE TYPE "public"."file_process_task_type" AS ENUM('duplicate_check', 'preview_generate', 'parse', 'index', 'vectorize');--> statement-breakpoint
CREATE TYPE "public"."file_source_type" AS ENUM('client', 'internal', 'public', 'original');--> statement-breakpoint
CREATE TYPE "public"."project_roles" AS ENUM('pm', 'member', 'director', 'sale_ld');--> statement-breakpoint
CREATE TYPE "public"."project_stage" AS ENUM('实施阶段', '销售阶段');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('active', 'preparing', 'completed', 'archived', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."system_roles" AS ENUM('user', 'dept_ld', 'dept_admin', 'admin');--> statement-breakpoint
CREATE TYPE "public"."weekly_report_action" AS ENUM('approve', 'reject');--> statement-breakpoint
CREATE TYPE "public"."weekly_report_item_type" AS ENUM('work', 'plan');--> statement-breakpoint
CREATE TYPE "public"."weekly_report_status" AS ENUM('draft', 'pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"parent_id" uuid,
	"level" smallint,
	"deleted_at" timestamp with time zone,
	"leader_id" uuid,
	CONSTRAINT "departments_name_unique" UNIQUE("name"),
	CONSTRAINT "departments_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"password_hash" text,
	"name" text,
	"employee_no" text,
	"email" varchar,
	"gender" text,
	"position" text,
	"department_id" uuid,
	"avatar_url" text,
	"deleted_at" timestamp with time zone,
	"role" "system_roles" DEFAULT 'user',
	CONSTRAINT "users_employeeNo_unique" UNIQUE("employee_no"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "contract_deliverables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"project_id" uuid,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "contract_deliverables_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"project_id" uuid,
	"user_id" uuid,
	"project_role" "project_roles" DEFAULT 'member'
);
--> statement-breakpoint
CREATE TABLE "project_week_exemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"project_id" uuid NOT NULL,
	"start_week_code" text NOT NULL,
	"end_week_code" text,
	"reason" text,
	"created_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"project_no" text,
	"project_name" text,
	"project_status" "project_status" DEFAULT 'preparing',
	"project_stage" "project_stage" DEFAULT '实施阶段' NOT NULL,
	"department_id" uuid,
	"start_date" text,
	"end_date" text,
	"industry_category" text,
	"customer_name" text,
	"business_type" text,
	"product_block" text,
	"project_introduction" text,
	"contract_no" text,
	"fiscal_year" text,
	CONSTRAINT "projects_contractNo_unique" UNIQUE("contract_no")
);
--> statement-breakpoint
CREATE TABLE "file_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_id" uuid,
	"content" text NOT NULL,
	"is_public" boolean DEFAULT true,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "file_download_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid,
	"file_id" uuid,
	"downloaded_at" timestamp with time zone,
	"ip_address" text
);
--> statement-breakpoint
CREATE TABLE "file_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"file_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"user_role_at_time" text,
	"interaction_type" text NOT NULL,
	CONSTRAINT "file_interactions_fileId_userId_interactionType_unique" UNIQUE("file_id","user_id","interaction_type"),
	CONSTRAINT "file_interactions_interaction_type_check" CHECK ("file_interactions"."interaction_type" in ('favorite', 'recommend'))
);
--> statement-breakpoint
CREATE TABLE "file_process_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"task_type" "file_process_task_type" NOT NULL,
	"status" "file_process_status" DEFAULT 'pending',
	"result_data" jsonb,
	"error_msg" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "file_process_tasks_fileId_taskType_unique" UNIQUE("file_id","task_type")
);
--> statement-breakpoint
CREATE TABLE "file_reference_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_file_id" uuid NOT NULL,
	"deliverable_file_id" uuid NOT NULL,
	CONSTRAINT "file_reference_links_referenceFileId_deliverableFileId_unique" UNIQUE("reference_file_id","deliverable_file_id")
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_size" bigint NOT NULL,
	"file_ext" text,
	"mime_type" text,
	"source_storage_key" text NOT NULL,
	"preview_storage_key" text,
	"preview_status" "file_preview_status" DEFAULT 'pending',
	"uploader_id" uuid NOT NULL,
	"version_group_id" uuid NOT NULL,
	"version_no" integer DEFAULT 1 NOT NULL,
	"version_label" text,
	"is_latest" boolean DEFAULT true,
	"is_deliverable" boolean DEFAULT false,
	"contract_deliverable_id" uuid,
	"file_source" "file_source_type",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_confidential" boolean DEFAULT false,
	"extract_status" text,
	CONSTRAINT "chk_version_no_positive" CHECK ("files"."version_no" > 0)
);
--> statement-breakpoint
CREATE TABLE "weekly_report_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"report_id" uuid NOT NULL,
	"approver_id" uuid NOT NULL,
	"action" "weekly_report_action" NOT NULL,
	"reject_reason" text,
	"approved_at" timestamp with time zone,
	"is_overdue" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_report_file_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"report_item_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	CONSTRAINT "weekly_report_file_links_reportItemId_fileId_unique" UNIQUE("report_item_id","file_id")
);
--> statement-breakpoint
CREATE TABLE "weekly_report_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"report_id" uuid NOT NULL,
	"item_type" "weekly_report_item_type" DEFAULT 'work' NOT NULL,
	"item_desc" text,
	"work_days" numeric(4, 1),
	"work_dates" jsonb,
	"sort_order" smallint DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "weekly_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"week_code" text NOT NULL,
	"status" "weekly_report_status" DEFAULT 'draft' NOT NULL,
	"submit_time" timestamp with time zone,
	"is_overdue" boolean DEFAULT false NOT NULL,
	CONSTRAINT "weekly_reports_userId_projectId_weekCode_unique" UNIQUE("user_id","project_id","week_code")
);
--> statement-breakpoint
CREATE TABLE "weeks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"year" integer NOT NULL,
	"week_no" integer NOT NULL,
	"week_code" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"deadline" timestamp with time zone,
	"is_locked" boolean DEFAULT false NOT NULL,
	CONSTRAINT "weeks_year_weekNo_unique" UNIQUE("year","week_no")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"sender_id" uuid
);
--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_departments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_deliverables" ADD CONSTRAINT "contract_deliverables_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_week_exemptions" ADD CONSTRAINT "project_week_exemptions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_week_exemptions" ADD CONSTRAINT "project_week_exemptions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_comments" ADD CONSTRAINT "file_comments_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_comments" ADD CONSTRAINT "file_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_comments" ADD CONSTRAINT "file_comments_parent_id_file_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."file_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_comments" ADD CONSTRAINT "file_comments_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_download_record" ADD CONSTRAINT "file_download_record_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_download_record" ADD CONSTRAINT "file_download_record_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_interactions" ADD CONSTRAINT "file_interactions_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_interactions" ADD CONSTRAINT "file_interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_process_tasks" ADD CONSTRAINT "file_process_tasks_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_reference_links" ADD CONSTRAINT "file_reference_links_reference_file_id_files_id_fk" FOREIGN KEY ("reference_file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_reference_links" ADD CONSTRAINT "file_reference_links_deliverable_file_id_files_id_fk" FOREIGN KEY ("deliverable_file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_contract_deliverable_id_contract_deliverables_id_fk" FOREIGN KEY ("contract_deliverable_id") REFERENCES "public"."contract_deliverables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_report_approvals" ADD CONSTRAINT "weekly_report_approvals_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_report_file_links" ADD CONSTRAINT "weekly_report_file_links_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_report_items" ADD CONSTRAINT "weekly_report_items_report_id_weekly_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."weekly_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;