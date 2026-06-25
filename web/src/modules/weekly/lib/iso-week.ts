/**
 * ISO 8601 周次编码 YYYY-Www（与 weeks.week_code / weekly_reports.week_code 对齐）
 */

const WEEK_CODE_RE = /^(\d{4})-W(\d{2})$/

export function parseWeekCode(
  code: string
): { year: number; week: number } | null {
  const m = WEEK_CODE_RE.exec(code.trim())
  if (!m) return null
  return { year: Number(m[1]), week: Number(m[2]) }
}

/** 某 ISO 年、周次的周一 00:00（本地时区） */
export function mondayOfISOWeek(isoYear: number, week: number): Date {
  const jan4 = new Date(isoYear, 0, 4)
  const day = (jan4.getDay() + 6) % 7
  const week1Monday = new Date(jan4)
  week1Monday.setDate(jan4.getDate() - day)
  const monday = new Date(week1Monday)
  monday.setDate(week1Monday.getDate() + (week - 1) * 7)
  monday.setHours(0, 0, 0, 0)
  return monday
}

/** 从日期得到 ISO 周次编码（本地日历日） */
export function getISOWeekString(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const week =
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    )
  const isoYear = d.getFullYear()
  return `${isoYear}-W${String(week).padStart(2, '0')}`
}

export function getCurrentWeekCode(): string {
  return getISOWeekString(new Date())
}

export function shiftWeekCode(weekCode: string, deltaWeeks: number): string | null {
  const p = parseWeekCode(weekCode)
  if (!p) return null
  const monday = mondayOfISOWeek(p.year, p.week)
  monday.setDate(monday.getDate() + deltaWeeks * 7)
  return getISOWeekString(monday)
}

export function listWeekCodesDescending(
  endCode: string,
  count: number
): string[] {
  const codes: string[] = []
  let cur: string | null = endCode
  for (let i = 0; i < count && cur; i++) {
    codes.push(cur)
    cur = shiftWeekCode(cur, -1)
  }
  return codes
}

export function weekCodesInclusiveRange(
  startCode: string,
  endCode: string
): string[] {
  const start = parseWeekCode(startCode)
  const end = parseWeekCode(endCode)
  if (!start || !end) return []
  const m1 = mondayOfISOWeek(start.year, start.week).getTime()
  const m2 = mondayOfISOWeek(end.year, end.week).getTime()
  if (m1 > m2) return []

  const out: string[] = []
  let cur = startCode
  for (;;) {
    out.push(cur)
    if (cur === endCode) break
    const next = shiftWeekCode(cur, 1)
    if (!next) break
    cur = next
  }
  return out
}

export function compareWeekCode(a: string, b: string): number {
  const pa = parseWeekCode(a)
  const pb = parseWeekCode(b)
  if (!pa || !pb) return a.localeCompare(b)
  const ta = mondayOfISOWeek(pa.year, pa.week).getTime()
  const tb = mondayOfISOWeek(pb.year, pb.week).getTime()
  return ta - tb
}

export function formatWeekCodeLabelZh(weekCode: string): string {
  const p = parseWeekCode(weekCode.trim())
  if (!p) return weekCode.trim()
  return `${p.year}年第${p.week}周`
}
