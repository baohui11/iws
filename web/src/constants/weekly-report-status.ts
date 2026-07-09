export type WeeklyReportStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'withdrawn'

export const WEEKLY_REPORT_STATUS_LABEL: Record<WeeklyReportStatus, string> = {
  draft: '草稿',
  pending: '待审批',
  approved: '已通过',
  rejected: '已退回',
  withdrawn: '已撤回',
}

export const WEEKLY_REPORT_STATUS_COLOR: Record<
  WeeklyReportStatus,
  'default' | 'primary' | 'success' | 'warning' | 'danger'
> = {
  draft: 'default',
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  withdrawn: 'default',
}

/** 填写人可编辑、可再次提交审批的状态 */
export function isWeeklyReportEditableStatus(
  status: WeeklyReportStatus
): boolean {
  return status === 'draft' || status === 'rejected' || status === 'withdrawn'
}
