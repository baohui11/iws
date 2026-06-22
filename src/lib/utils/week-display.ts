import { parseWeekCode } from '@/lib/utils/iso-week'

/** 如 2025年第1周 */
export function formatWeekTitleZh(weekCode: string): string {
  const p = parseWeekCode(weekCode)
  if (!p) return weekCode
  return `${p.year}年第${p.week}周`
}

function fmtMd(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return isoDate
  return `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`
}

/** 浅色行用：03/24~03/30 */
export function formatWeekRangeLine(
  startDate: string | null,
  endDate: string | null
): string {
  if (!startDate?.trim() || !endDate?.trim()) return ''
  return `${fmtMd(startDate.trim())}~${fmtMd(endDate.trim())}`
}

/** 仅周起始日（来自 weeks.start_date），如 03/24 */
export function formatWeekStartLine(startDate: string | null | undefined): string {
  if (!startDate?.trim()) return ''
  return fmtMd(startDate.trim())
}

/** 今天（本地日历日 YYYY-MM-DD）是否落在 [start, end] 内（含边界） */
export function isTodayInWeekRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined
): boolean {
  const s = startDate?.trim()
  const e = endDate?.trim()
  if (!s || !e) return false
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const today = `${y}-${m}-${d}`
  return today >= s && today <= e
}
