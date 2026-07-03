ALTER TYPE "system_roles" ADD VALUE IF NOT EXISTS 'bp';--> statement-breakpoint
ALTER TYPE "system_roles" ADD VALUE IF NOT EXISTS 'company_ld';--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'data_scope_type') THEN
    CREATE TYPE "public"."data_scope_type" AS ENUM('department', 'all');
  END IF;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_data_scopes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "user_id" uuid NOT NULL,
  "scope_type" "data_scope_type" NOT NULL,
  "department_id" uuid,
  "include_children" boolean DEFAULT true NOT NULL
);--> statement-breakpoint
ALTER TABLE "user_data_scopes" ADD CONSTRAINT "user_data_scopes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_data_scopes" ADD CONSTRAINT "user_data_scopes_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_data_scopes_user" ON "user_data_scopes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_data_scopes_department" ON "user_data_scopes" USING btree ("department_id");
