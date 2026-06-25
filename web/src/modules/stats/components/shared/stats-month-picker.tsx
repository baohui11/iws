'use client'

import { DatePicker, cn } from '@heroui/react'
import { parseDate, type DateValue } from '@internationalized/date'

function ymToIsoDay(ym: string): string | null {
  if (!/^\d{4}-\d{2}$/.test(ym)) return null
  return `${ym}-01`
}

function dateValueToYearMonth(d: DateValue | null): string {
  if (!d) return ''
  return `${d.year}-${String(d.month).padStart(2, '0')}`
}

export type StatsMonthPickerProps = {
  value: string
  onChange: (yearMonth: string) => void
  'aria-label'?: string
  className?: string
}

/** 月份筛选：HeroUI DatePicker，内部用当月 1 日，变更时只保留 YYYY-MM */
export function StatsMonthPicker({
  value,
  onChange,
  'aria-label': ariaLabel = '月份',
  className,
}: StatsMonthPickerProps) {
  const iso = ymToIsoDay(value)
  return (
    <DatePicker
      aria-label={ariaLabel}
      size="sm"
      variant="bordered"
      className={cn('w-full min-w-[10rem] max-w-[14rem]', className)}
      value={iso ? parseDate(iso) : null}
      onChange={(d) => onChange(dateValueToYearMonth(d))}
      showMonthAndYearPickers
    />
  )
}
