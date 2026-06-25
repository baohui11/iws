import { parseWeekCode } from '@/modules/weekly/lib/iso-week'

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

export function formatWeekRangeLine(
  startDate: string | null,
  endDate: string | null
): string {
  if (!startDate?.trim() || !endDate?.trim()) return ''
  return `${fmtMd(startDate.trim())}~${fmtMd(endDate.trim())}`
}

export function formatWeekStartLine(
  startDate: string | null | undefined
): string {
  if (!startDate?.trim()) return ''
  return fmtMd(startDate.trim())
}

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
