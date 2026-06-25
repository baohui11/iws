export interface DeptOption {
  id: string
  label: string
}

/** 部门周报统计 · 按人员 */
export interface WeeklyDeptByPersonRow {
  user_id: string
  user_name: string
  has_dept_project: boolean
  has_report: boolean
  work_days: number
  project_count: number
  file_upload_count: number
}

/** 部门周报统计 · 按项目 */
export interface WeeklyDeptByProjectRow {
  project_id: string
  project_no: string | null
  project_name: string | null
  project_status: string | null
  no_work_exemption: boolean
  report_count: number
  pending_count: number
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
  submitted_at: string | null
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
  work_days: number
  original_work_days: number
}

/** 考勤 · 项目汇总：每人每项目一行 */
export interface AttendanceProjectSummaryRow {
  user_id: string
  user_name: string
  employee_no: string | null
  project_id: string
  project_name: string | null
  work_days: number
}

export interface FileDownloadByPersonRow {
  user_id: string | null
  user_name: string
  download_count: number
}

export interface FileDownloadDetailRow {
  id: string
  downloaded_at: string | null
  file_id: string | null
  file_name: string | null
  user_id: string | null
  user_name: string | null
  ip_address: string | null
}

export interface FileDownloadDetailsPaged {
  rows: FileDownloadDetailRow[]
  total: number
}

export interface WeekOptionLite {
  week_code: string
  title_zh: string
  range_line: string
}
