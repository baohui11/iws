ALTER TABLE "project_members" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
UPDATE "project_members" SET "is_active" = true WHERE "is_active" IS NULL;
