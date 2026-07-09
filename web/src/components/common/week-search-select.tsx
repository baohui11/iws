'use client'

import { Chip } from '@heroui/react'
import SearchableSelect from '@/components/common/searchable-select'

export interface WeekSearchSelectOption {
  week_code: string
  title_zh: string
  range_line?: string | null
  is_current?: boolean
}

interface WeekSearchSelectProps<T extends WeekSearchSelectOption> {
  weekOptions: T[]
  value: string
  onChange: (weekCode: string, week: T | null) => void
  label?: string
  placeholder?: string
  isDisabled?: boolean
  className?: string
  variant?: 'flat' | 'bordered' | 'underlined' | 'faded'
  size?: 'sm' | 'md' | 'lg'
  disallowEmpty?: boolean
}

export default function WeekSearchSelect<T extends WeekSearchSelectOption>({
  weekOptions,
  value,
  onChange,
  label = '周次',
  placeholder = '输入周次或日期搜索',
  isDisabled,
  className,
  variant = 'bordered',
  size = 'md',
}: WeekSearchSelectProps<T>) {
  return (
    <SearchableSelect
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={(weekCode) => {
        onChange(
          weekCode,
          weekOptions.find((week) => week.week_code === weekCode) ?? null
        )
      }}
      options={weekOptions.map((week) => ({
        key: week.week_code,
        label: week.title_zh,
        searchText: `${week.week_code} ${week.title_zh} ${week.range_line ?? ''}`,
        content: (
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-sm text-foreground">
              {week.title_zh}
            </span>
            {week.range_line ? (
              <span className="min-w-0 truncate text-xs text-default-400">
                {week.range_line}
              </span>
            ) : null}
            {week.is_current ? (
              <Chip
                size="sm"
                variant="flat"
                color="success"
                classNames={{
                  base: 'h-5 min-h-5 px-1.5',
                  content: 'text-[10px] font-normal',
                }}
              >
                本周
              </Chip>
            ) : null}
          </div>
        ),
      }))}
      isDisabled={isDisabled || weekOptions.length === 0}
      variant={variant}
      size={size}
      className={className}
    />
  )
}
