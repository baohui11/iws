import type { Enums } from '@/types/database'
import type { WeeklyReportEditorItem } from '@/types/weekly-report-editor'

export interface MemberProjectOption {
  id: string
  project_no: string | null
  project_name: string | null
  department_id: string | null
  department_name: string | null
}

export interface WeekOption {
  week_code: string
  /** 主标题：2025年第1周 */
  title_zh: string
  /** 副标题：03/24~03/30 */
  range_line: string
  start_date: string | null
  end_date: string | null
  /** 今天是否落在此周的起止日内（weeks 表） */
  is_current: boolean
}

/** 我填写的周报 + 工时汇总（每条对应 user×project×week 一条） */
export interface MyFilledReportRow {
  id: string
  project_id: string
  week_code: string
  status: Enums<'weekly_report_status'>
  project_name: string | null
  /** 事项条数 */
  item_count: number
  /** 合计工时（小时） */
  total_work_hours: number
  /** 折算工作天数（工时/8） */
  work_days: number
}

export type MyFilledGroupView = 'by_week' | 'by_project'

export interface PmApprovalListRow {
  id: string
  project_id: string
  week_code: string
  status: Enums<'weekly_report_status'>
  project_name: string | null
  author_name: string
  author_id: string
  /** 是否已有本人审批记录 */
  has_my_approval: boolean
}

/** 待我审批列表：审批侧筛选（?approval=） */
export type ApprovalDoneFilter =
  | 'all'
  | 'pending'
  | 'rejected'
  | 'approved'

export interface MyFilledReportsPaged {
  rows: MyFilledReportRow[]
  total: number
}

export interface MyFilledReportsParams {
  userId: string
  /** 为空表示不按周过滤 */
  weekCodes: string[]
  /** 为空表示不按项目过滤（成员项目范围内） */
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

/** 项目周报 Tab：单条成员周报摘要 */
export interface ProjectWeeklyReporterRow {
  report_id: string
  user_id: string
  user_name: string
  work_days: number
  status: Enums<'weekly_report_status'>
}

/** 项目周报 Tab：按周聚合 */
export interface ProjectWeeklyWeekGroup {
  week_code: string
  title_zh: string
  range_line: string
  is_current: boolean
  /** 该周在项目「无工作」记录（project_week_exemptions）内 */
  is_no_work_week: boolean
  /** 该周该项目下非草稿周报的工作日合计 */
  total_work_days: number
  reporters: ProjectWeeklyReporterRow[]
}

export interface ProjectWeeklyWeeksPage {
  weeks: ProjectWeeklyWeekGroup[]
  totalWeeks: number
}

/** 项目某周详情：聚合所有人「本周工作」事项 */
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
  /** 该周全部成员的「下周计划」事项（item_type=plan） */
  planItems: ProjectWeekWorkItemRow[]
  /** 填报周结束后的下一自然周（周一至周日），用于计划区块标题；无周历时为 null */
  next_plan_range_line: string | null
}

/** 项目经理「无工作」区间列表行 */
export interface ProjectWeekExemptionListRow {
  id: string
  project_id: string
  project_name: string | null
  start_week_code: string
  end_week_code: string | null
  created_at: string
  created_by: string
}
