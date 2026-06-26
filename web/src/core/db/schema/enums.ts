import { pgEnum } from 'drizzle-orm/pg-core'

export const filePipelineStatus = pgEnum('file_pipeline_status', [
  'pending',
  'processing',
  'ready',
  'failed',
  'skipped',
])

export const fileProcessStage = pgEnum('file_process_stage', [
  'preview',
  'parse',
  'index',
])

export const fileSourceType = pgEnum('file_source_type', [
  'client',
  'internal',
  'public',
  'original',
])

export const projectRoles = pgEnum('project_roles', [
  'pm',
  'member',
  'director',
  'sale_ld',
])

export const projectStage = pgEnum('project_stage', ['实施阶段', '销售阶段'])

export const projectStatus = pgEnum('project_status', [
  'active',
  'preparing',
  'completed',
  'archived',
  'suspended',
])

export const systemRoles = pgEnum('system_roles', [
  'user',
  'dept_ld',
  'dept_admin',
  'admin',
])

export const weeklyReportAction = pgEnum('weekly_report_action', [
  'approve',
  'reject',
])

export const weeklyReportItemType = pgEnum('weekly_report_item_type', [
  'work',
  'plan',
])

export const weeklyReportStatus = pgEnum('weekly_report_status', [
  'draft',
  'pending',
  'approved',
  'rejected',
])
