/**
 * 当前时间是否已超过 `weeks.deadline`。
 */
export function isNowAfterWeekDeadline(
  deadline: string | null | undefined
): boolean {
  if (deadline == null || !String(deadline).trim()) return false
  const t = Date.parse(String(deadline).trim())
  if (Number.isNaN(t)) return false
  return Date.now() > t
}
