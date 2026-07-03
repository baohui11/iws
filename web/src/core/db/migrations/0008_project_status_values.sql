ALTER TABLE "projects" ALTER COLUMN "project_status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "project_status" TYPE text USING
  CASE "project_status"::text
    WHEN 'active' THEN '进行中'
    WHEN 'preparing' THEN '进行中'
    WHEN 'completed' THEN '已结项'
    WHEN 'archived' THEN '已关闭'
    WHEN 'suspended' THEN '终止'
    ELSE "project_status"::text
  END;--> statement-breakpoint
DROP TYPE IF EXISTS "project_status";--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('进行中', '预结项', '已结项', '终止', '已关闭');--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "project_status" TYPE "project_status" USING "project_status"::"project_status";--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "project_status" SET DEFAULT '进行中';
