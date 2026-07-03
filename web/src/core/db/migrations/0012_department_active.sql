ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT false NOT NULL;
