import { getCurrentWeekCode, mondayOfISOWeek, parseWeekCode } from '@/lib/utils/iso-week'

/** 当前 ISO 周周一所在自然月，YYYY-MM（作为考勤月份上界） */
export function getYearMonthOfCurrentWeek(): string {
  const wc = getCurrentWeekCode()
  const p = parseWeekCode(wc)
  if (!p) {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  const monday = mondayOfISOWeek(p.year, p.week)
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}`
}

function compareYearMonthKey(a: string, b: string): number {
  return a.localeCompare(b)
}

/**
 * 月份下拉：2022年1月 ～ 当前周所在月，**降序**（最新在上）
 */
export function buildYearMonthOptionsDescending(): { key: string; label: string }[] {
  const maxKey = getYearMonthOfCurrentWeek()
  const ascending: { key: string; label: string }[] = []
  let y = 2022
  let m = 1
  while (true) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    if (compareYearMonthKey(key, maxKey) > 0) break
    ascending.push({ key, label: `${y}年${m}月` })
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  ascending.reverse()
  return ascending
}
