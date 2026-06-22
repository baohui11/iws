/** 部门周报统计 · 按人员 */
export interface WeeklyDeptByPersonRow {
  user_id: string
  user_name: string
  /** 该周在部门项目内有成员关系 */
  has_dept_project: boolean
  /** 该周次在部门项目下存在非草稿周报 */
  has_report: boolean
  /** 合计工作天数（该周、部门项目范围内） */
  work_days: number
  /** 参与项目数（该周有周报的 distinct project） */
  project_count: number
  /** 上传文件数（周时间窗内、部门项目） */
  file_upload_count: number
}

/** 部门周报统计 · 按项目 */
export interface WeeklyDeptByProjectRow {
  project_id: string
  project_no: string | null
  project_name: string | null
  project_status: string | null
  /** 该周落在 project_week_exemptions 区间内（无工作周） */
  no_work_exemption: boolean
  /** 该周周报条数（非草稿） */
  report_count: number
  /** 待审批条数 */
  pending_count: number
  /** 合计工作天数 */
  total_work_days: number
}

/** 部门周报 · 明细 */
export interface WeeklyDeptDetailRow {
  report_id: string
  user_id: string
  user_name: string
  project_id: string
  project_no: string | null
  project_name: string | null
  week_code: string
  status: string
  work_days: number
  item_count: number
  /** 非草稿时取 created_at，否则 — */
  submitted_at: string | null
  /** 审批记录中最晚一条时间，无则 — */
  approved_at: string | null
  submit_overdue: string
  submit_overdue_reason: string
  approval_overdue: string
  approval_overdue_reason: string
}

/** 文件统计报表行 */
export interface FileStatsRow {
  id: string
  file_name: string
  file_size: number
  file_ext: string | null
  created_at: string
  uploader_name: string | null
  project_no: string | null
  project_name: string | null
  department_label: string
  is_deliverable: boolean
  is_confidential: boolean
  file_source: string | null
}

export interface FileStatsPaged {
  rows: FileStatsRow[]
  total: number
  hasMore: boolean
}

/** 考勤汇总：每人一行 */
export interface AttendanceSummaryRowPerson {
  user_id: string
  user_name: string
  employee_no: string | null
  work_days: number
}

/** 考勤明细：按工作事项 */
export interface AttendanceDetailRow {
  id: string
  user_name: string
  employee_no: string | null
  project_name: string | null
  week_label: string
  work_content: string
  date_range: string
  /** 计入所选月份的天数（按 work_dates / 跨月分摊） */
  work_days: number
  /** 事项上填报的原始天数（未按月份拆分） */
  original_work_days: number
}

/** 考勤 · 项目汇总：每人每项目一行 */
export interface AttendanceProjectSummaryRow {
  user_id: string
  user_name: string
  employee_no: string | null
  project_id: string
  project_name: string | null
  /** 所选月份内合计考勤天数 */
  work_days: number
}

export type {
  FileDownloadByPersonRow,
  FileDownloadDetailRow,
  FileDownloadDetailsPaged,
} from '@/lib/db/stats/file-download-audit'
