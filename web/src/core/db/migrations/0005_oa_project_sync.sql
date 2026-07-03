ALTER TABLE "projects" DROP COLUMN IF EXISTS "industry_category";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN IF EXISTS "customer_name";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN IF EXISTS "business_type";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN IF EXISTS "product_block";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN IF EXISTS "project_introduction";--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_contractNo_unique";--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "project_type" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project_members" ADD COLUMN IF NOT EXISTS "project_stage" text;--> statement-breakpoint
ALTER TABLE "project_members" ALTER COLUMN "project_role" TYPE text USING "project_role"::text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_projects_project_no" ON "projects" USING btree ("project_no");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_project_members_sync_key" ON "project_members" USING btree ("project_id","user_id","project_stage");--> statement-breakpoint
