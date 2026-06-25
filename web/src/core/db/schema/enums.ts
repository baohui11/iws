import { pgEnum } from 'drizzle-orm/pg-core'

export const filePreviewStatus = pgEnum('file_preview_status', [
  'pending',
  'processing',
  'success',
  'failure',
])

export const fileProcessStatus = pgEnum('file_process_status', [
  'pending',
  'processing',
  'success',
  'failure',
])

export const fileProcessTaskType = pgEnum('file_process_task_type', [
  'duplicate_check',
  'preview_generate',
  'parse',
  'index',
  'vectorize',
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
