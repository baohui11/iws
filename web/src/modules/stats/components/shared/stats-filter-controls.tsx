'use client'

import { DateRangePicker, Input } from '@heroui/react'
import type { DateValue } from '@internationalized/date'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import SearchableSelect from '@/components/common/searchable-select'
import WeekSearchSelect from '@/components/common/week-search-select'
import {
  PROJECT_STAGE_IMPLEMENTATION,
  PROJECT_STAGE_LABEL,
  PROJECT_STAGE_SALES,
} from '@/constants/project-stage'
import type { DeptOption, WeekOptionLite } from '@/modules/stats/types'
import { StatsLabelField } from '@/modules/stats/components/shared/stats-label-field'
import { StatsYearMonthSelect } from '@/modules/stats/components/shared/stats-year-month-select'

export const STATS_SELECT_CLASS = 'w-full min-w-[11rem] max-w-[16rem]'
export const STATS_SEARCH_CLASS = 'w-full min-w-[12rem] max-w-[18rem]'
export const STATS_WEEK_CLASS = 'w-full min-w-[13rem] max-w-[17rem]'
export const STATS_DATE_RANGE_CLASS = 'w-full min-w-[18rem] max-w-[28rem]'

export function StatsFilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-default-200/80 bg-default-50/50 p-3">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-4 lg:gap-y-2">
        {children}
      </div>
    </div>
  )
}

export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [delayMs, value])

  return debounced
}

export function StatsDepartmentSelect({
  value,
  onChange,
  departmentOptions,
  includeAll = false,
  className = STATS_SELECT_CLASS,
}: {
  value: string
  onChange: (departmentId: string) => void
  departmentOptions: DeptOption[]
  includeAll?: boolean
  className?: string
}) {
  const options = useMemo(
    () => [
      ...(includeAll ? [{ key: 'all', label: '全部部门', searchText: '全部部门' }] : []),
      ...departmentOptions.map((dept) => ({
        key: dept.id,
        label: dept.label,
        searchText: dept.label,
      })),
    ],
    [departmentOptions, includeAll]
  )

  return (
    <StatsLabelField label="部门">
      <SearchableSelect
        aria-label="部门"
        value={value}
        onChange={onChange}
        options={options}
        placeholder="全部部门"
        variant="bordered"
        size="sm"
        className={className}
      />
    </StatsLabelField>
  )
}

export function StatsWeekSelect({
  label = '周次',
  value,
  onChange,
  weekOptions,
  className = STATS_WEEK_CLASS,
}: {
  label?: string
  value: string
  onChange: (weekCode: string) => void
  weekOptions: WeekOptionLite[]
  className?: string
}) {
  return (
    <StatsLabelField label={label}>
      <WeekSearchSelect
        label=""
        placeholder="选择周次"
        value={value}
        onChange={(weekCode) => onChange(weekCode)}
        weekOptions={weekOptions}
        variant="bordered"
        size="sm"
        className={className}
      />
    </StatsLabelField>
  )
}

export function StatsProjectStageSelect({
  value,
  onChange,
  className = STATS_SELECT_CLASS,
}: {
  value: string
  onChange: (projectStage: string) => void
  className?: string
}) {
  return (
    <StatsLabelField label="阶段">
      <SearchableSelect
        value={value}
        onChange={onChange}
        options={[
          { key: PROJECT_STAGE_IMPLEMENTATION, label: PROJECT_STAGE_LABEL[PROJECT_STAGE_IMPLEMENTATION] },
          { key: PROJECT_STAGE_SALES, label: PROJECT_STAGE_LABEL[PROJECT_STAGE_SALES] },
        ]}
        emptyOptionLabel="全部阶段"
        placeholder="全部阶段"
        variant="bordered"
        size="sm"
        className={className}
      />
    </StatsLabelField>
  )
}

export function StatsTextFilter({
  label,
  value,
  onChange,
  placeholder = '模糊',
  className = STATS_SEARCH_CLASS,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <StatsLabelField label={label}>
      <Input
        aria-label={`${label}模糊`}
        size="sm"
        variant="bordered"
        className={className}
        value={value}
        onValueChange={onChange}
        placeholder={placeholder}
      />
    </StatsLabelField>
  )
}

export function StatsMonthFilter({
  value,
  onChange,
}: {
  value: string
  onChange: (yearMonth: string) => void
}) {
  return (
    <StatsLabelField label="月份">
      <StatsYearMonthSelect value={value} onChange={onChange} />
    </StatsLabelField>
  )
}

export function StatsDateRangeFilter({
  value,
  onChange,
}: {
  value: { start: DateValue; end: DateValue }
  onChange: (value: { start: DateValue; end: DateValue }) => void
}) {
  return (
    <StatsLabelField label="日期" className="lg:min-w-[min(100%,28rem)]">
      <DateRangePicker
        aria-label="日期范围"
        size="sm"
        variant="bordered"
        value={value}
        onChange={(range) => {
          if (range?.start && range?.end) onChange({ start: range.start, end: range.end })
        }}
        granularity="day"
        visibleMonths={2}
        className={STATS_DATE_RANGE_CLASS}
      />
    </StatsLabelField>
  )
}
