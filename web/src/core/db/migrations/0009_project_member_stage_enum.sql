ALTER TABLE "project_members" ALTER COLUMN "project_stage" TYPE "project_stage" USING
  CASE
    WHEN "project_stage"::text IN ('实施阶段', '销售阶段') THEN "project_stage"::text::"project_stage"
    ELSE NULL
  END;
