ALTER TABLE "departments" DROP COLUMN IF EXISTS "leader_id";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_dept_leader" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "users" SET "is_active" = true WHERE "deleted_at" IS NULL;--> statement-breakpoint
