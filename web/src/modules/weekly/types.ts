import type { WeeklyReportStatus } from '@/constants/weekly-report-status'
import type { ProjectStageValue } from '@/constants/project-stage'
import type { WeekHalfSlot } from '@/modules/weekly/lib/weekly-report-work-slots'

export type WeeklyReportItemType = 'work' | 'plan'

export interface MemberProjectOption {
  id: string
  project_no: string | null
  project_name: string | null
  project_stage: ProjectStageValue | null
  available_project_stages: ProjectStageValue[]
  department_id: string | null
  department_name: string | null
}

export interface WeekOption {
  week_code: string
  title_zh: string
  range_line: string
  start_date: string | null
  end_date: string | null
  is_current: boolean
}

export interface MyFilledReportRow {
  id: string
  project_id: string
  week_code: string
  project_stage: ProjectStageValue
  status: WeeklyReportStatus
  project_name: string | null
  item_count: number
  total_work_hours: number
  work_days: number
}

export interface WeeklyDashboardRecentProject {
  project_id: string
  project_name: string | null
  stages: ProjectStageValue[]
  action_stage: ProjectStageValue | null
  latest_week_code: string
  latest_status: WeeklyReportStatus
  can_create_report: boolean
  can_upload_file: boolean
}

export type MyFilledGroupView = 'by_week' | 'by_project'

export interface PmApprovalListRow {
  id: string
  project_id: string
  week_code: string
  project_stage: ProjectStageValue
  status: WeeklyReportStatus
  project_name: string | null
  author_name: string
  author_id: string
  has_my_approval: boolean
}

export type ApprovalDoneFilter = 'all' | 'pending' | 'rejected' | 'approved'

export interface MyFilledReportsPaged {
  rows: MyFilledReportRow[]
  total: number
}

export interface MyFilledReportsParams {
  userId: string
  weekCodes: string[]
  projectIds: string[]
  offset?: number
  limit?: number
}

export interface PmApprovalListPaged {
  rows: PmApprovalListRow[]
  total: number
}

export interface PmApprovalListParams {
  userId: string
  approvalFilter: ApprovalDoneFilter
  weekCodes: string[]
  projectIds: string[]
  offset?: number
  limit?: number
}

export interface ProjectWeeklyReporterRow {
  report_id: string
  user_id: string
  user_name: string
  work_days: number
  status: WeeklyReportStatus
}

export interface ProjectWeeklyWeekGroup {
  week_code: string
  title_zh: string
  range_line: string
  is_current: boolean
  is_no_work_week: boolean
  total_work_days: number
  reporters: ProjectWeeklyReporterRow[]
}

export interface ProjectWeeklyWeeksPage {
  weeks: ProjectWeeklyWeekGroup[]
  totalWeeks: number
}

export interface WeeklyReportItemFileRef {
  id: string
  file_name: string
}

export interface WeeklyReportEditorItem {
  id: string
  item_type: WeeklyReportItemType
  item_desc: string | null
  work_slots: WeekHalfSlot[]
  work_days: number | null
  sort_order: number
  file_ids: string[]
  files: WeeklyReportItemFileRef[]
}

export interface ProjectWeekWorkItemRow {
  report_id: string
  author_id: string
  author_name: string
  item: WeeklyReportEditorItem
}

export interface ProjectWeekWorkItemsPage {
  projectName: string | null
  week_code: string
  title_zh: string
  range_line: string
  is_current: boolean
  is_no_work_week: boolean
  workItems: ProjectWeekWorkItemRow[]
  planItems: ProjectWeekWorkItemRow[]
  next_plan_range_line: string | null
}

export interface ProjectWeekExemptionListRow {
  id: string
  project_id: string
  project_name: string | null
  start_week_code: string
  end_week_code: string | null
  created_at: string
  created_by: string
}

export interface WeeklyReportWeekBounds {
  week_code: string
  start_date: string
  end_date: string
  deadline: string | null
}

export interface NextWeekBounds {
  start_date: string
  end_date: string
}

export interface WeeklyReportEditorProject {
  id: string
  project_no: string | null
  project_name: string | null
}

export interface WeeklyReportEditorPayload {
  report: {
    id: string
    status: WeeklyReportStatus
    user_id: string
    project_id: string
    week_code: string
    project_stage: ProjectStageValue
    is_overdue: boolean
  }
  week: WeeklyReportWeekBounds
  next_week: NextWeekBounds
  project: WeeklyReportEditorProject
  items: WeeklyReportEditorItem[]
  used_slots_other_reports_work: WeekHalfSlot[]
  used_slots_other_reports_plan: WeekHalfSlot[]
}

export interface WeeklyReportDetailPayload {
  report: {
    id: string
    status: WeeklyReportStatus
    user_id: string
    project_id: string
    week_code: string
    project_stage: ProjectStageValue
    submit_time: string | null
    created_at: string
    is_overdue: boolean
  }
  week: WeeklyReportWeekBounds
  next_week: NextWeekBounds
  project: WeeklyReportEditorProject
  author_name: string | null
  items: WeeklyReportEditorItem[]
  reject_reason: string | null
}

export interface WeeklyReportFilePickRow {
  id: string
  file_name: string
  created_at: string
  version_label: string | null
  is_latest: boolean
  is_deliverable: boolean
  sales_file_tag: string | null
  file_source: string | null
}
