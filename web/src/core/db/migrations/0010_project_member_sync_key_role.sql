DROP INDEX IF EXISTS "idx_project_members_sync_key";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_project_members_sync_key" ON "project_members" USING btree ("project_id","user_id","project_role");
