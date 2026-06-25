'use client'

import { Select, SelectItem } from '@heroui/react'
import { useMemo } from 'react'
import { buildYearMonthOptionsDescending } from '@/modules/stats/lib/stats-year-month'

export type StatsYearMonthSelectProps = {
  value: string
  onChange: (yearMonth: string) => void
  'aria-label'?: string
  className?: string
}

/** 月份筛选：下拉「2026年4月」，值为 YYYY-MM */
export function StatsYearMonthSelect({
  value,
  onChange,
  'aria-label': ariaLabel = '月份',
  className,
}: StatsYearMonthSelectProps) {
  const items = useMemo(() => buildYearMonthOptionsDescending(), [])

  return (
    <Select
      aria-label={ariaLabel}
      size="sm"
      variant="bordered"
      className={className ?? 'w-full min-w-[10rem] max-w-[14rem]'}
      selectedKeys={value ? new Set([value]) : new Set()}
      onSelectionChange={(keys) => {
        const k = [...keys][0] as string | undefined
        if (k) onChange(k)
      }}
      items={items}
    >
      {(item) => (
        <SelectItem key={item.key} textValue={item.label}>
          {item.label}
        </SelectItem>
      )}
    </Select>
  )
}
