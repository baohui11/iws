/** 自然日加天数，本地日历，返回 YYYY-MM-DD */
export function addCalendarDaysIso(isoDate: string, deltaDays: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate
  const y = Number(isoDate.slice(0, 4))
  const m = Number(isoDate.slice(5, 7))
  const d = Number(isoDate.slice(8, 10))
  const dt = new Date(y, m - 1, d + deltaDays)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/** 紧随 `weekEnd` 之后的下一自然周（周一至周日），用于「下周计划」日期范围 */
export function nextWeekRangeAfterWeekEnd(weekEndIso: string): {
  start_date: string
  end_date: string
} {
  return {
    start_date: addCalendarDaysIso(weekEndIso, 1),
    end_date: addCalendarDaysIso(weekEndIso, 7),
  }
}

/** 自然日 YYYY-MM-DD，含首尾；非法或逆序返回 0 */
export function inclusiveCalendarDays(
  startIsoDate: string,
  endIsoDate: string
): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startIsoDate)) return 0
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endIsoDate)) return 0
  const t0 = Date.UTC(
    Number(startIsoDate.slice(0, 4)),
    Number(startIsoDate.slice(5, 7)) - 1,
    Number(startIsoDate.slice(8, 10))
  )
  const t1 = Date.UTC(
    Number(endIsoDate.slice(0, 4)),
    Number(endIsoDate.slice(5, 7)) - 1,
    Number(endIsoDate.slice(8, 10))
  )
  if (t1 < t0) return 0
  return Math.round((t1 - t0) / 86400000) + 1
}

/** 日期是否在闭区间 [weekStart, weekEnd]（含）内 */
export function isDateInWeekRange(
  isoDate: string,
  weekStart: string,
  weekEnd: string
): boolean {
  return isoDate >= weekStart && isoDate <= weekEnd
}

/** 起止是否均落在本周且 start <= end */
export function isValidWorkRangeInWeek(
  startIsoDate: string,
  endIsoDate: string,
  weekStart: string,
  weekEnd: string
): boolean {
  if (!isDateInWeekRange(startIsoDate, weekStart, weekEnd)) return false
  if (!isDateInWeekRange(endIsoDate, weekStart, weekEnd)) return false
  return startIsoDate <= endIsoDate
}

/** 标准人天折算工时（8h/天） */
export function workHoursFromDays(days: number): number {
  if (!Number.isFinite(days) || days <= 0) return 0
  return Math.round(days * 8 * 10) / 10
}
