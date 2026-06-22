import type { Enums } from '@/types/database'
import type { WeekHalfSlot } from '@/lib/utils/weekly-report-work-slots'

export interface WeeklyReportWeekBounds {
  week_code: string
  start_date: string
  end_date: string
  /** `weeks.deadline`，未配置则为 null */
  deadline: string | null
}

/** 填报周之后的自然周（周一至周日），用于「下周工作计划」选半天 */
export interface NextWeekBounds {
  start_date: string
  end_date: string
}

export interface WeeklyReportEditorProject {
  id: string
  project_no: string | null
  project_name: string | null
}

export interface WeeklyReportItemFileRef {
  id: string
  file_name: string
}

export interface WeeklyReportEditorItem {
  id: string
  item_type: Enums<'weekly_report_item_type'>
  item_desc: string | null
  work_slots: WeekHalfSlot[]
  work_days: number | null
  sort_order: number
  file_ids: string[]
  files: WeeklyReportItemFileRef[]
}

export interface WeeklyReportEditorPayload {
  report: {
    id: string
    status: Enums<'weekly_report_status'>
    user_id: string
    project_id: string
    week_code: string
    /** 提交晚于 `weeks.deadline` 时为 true（草稿一般为 false） */
    is_overdue: boolean
  }
  week: WeeklyReportWeekBounds
  /** 下周自然周起止（用于 plan 类型事项） */
  next_week: NextWeekBounds
  project: WeeklyReportEditorProject
  items: WeeklyReportEditorItem[]
  /**
   * 同一用户、同一 week_code 下，除当前周报外，其他项目周报已占用的半天（本周工作 / 下周计划）。
   * 与当前页内其他行合并后传入选择器 `disabledSlots`。
   */
  used_slots_other_reports_work: WeekHalfSlot[]
  used_slots_other_reports_plan: WeekHalfSlot[]
}

export interface WeeklyReportDetailPayload {
  report: {
    id: string
    status: Enums<'weekly_report_status'>
    user_id: string
    project_id: string
    week_code: string
    submit_time: string | null
    created_at: string
    is_overdue: boolean
  }
  week: WeeklyReportWeekBounds
  next_week: NextWeekBounds
  project: WeeklyReportEditorProject
  author_name: string | null
  items: WeeklyReportEditorItem[]
  /** 状态为已退回时，最近一次驳回原因 */
  reject_reason: string | null
}

export interface DeliverablePickRow {
  id: string
  file_name: string
  created_at: string
  version_label: string | null
  /** 该文件在所属成果版本组内是否为当前最新上传 */
  is_latest: boolean
}
