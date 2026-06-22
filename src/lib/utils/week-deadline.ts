/**
 * 当前时间是否已超过 `weeks.deadline`（提交时写入 `weekly_reports.is_overdue`、填写页展示）。
 * `deadline` 为 ISO 字符串；未配置则不算逾期。
 */
export function isNowAfterWeekDeadline(
  deadline: string | null | undefined
): boolean {
  if (deadline == null || !String(deadline).trim()) return false
  const t = Date.parse(String(deadline).trim())
  if (Number.isNaN(t)) return false
  return Date.now() > t
}
