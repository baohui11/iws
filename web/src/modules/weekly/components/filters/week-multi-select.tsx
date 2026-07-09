'use client'

import { Chip } from '@heroui/react'
import SearchableMultiSelect from '@/components/common/searchable-multi-select'
import type { WeekOption } from '@/modules/weekly/types'

interface WeekMultiSelectProps {
  weekOptions: WeekOption[]
  selectedKeys: Set<string>
  onSelectionChange: (keys: Set<string>) => void
  isDisabled?: boolean
  className?: string
}

export default function WeekMultiSelect({
  weekOptions,
  selectedKeys,
  onSelectionChange,
  isDisabled,
  className,
}: WeekMultiSelectProps) {
  const items = weekOptions.map((w) => ({
    key: w.week_code,
    searchText: `${w.title_zh} ${w.week_code} ${w.range_line}`,
    children: (
      <div className="flex flex-col gap-0.5 py-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm leading-tight">{w.title_zh}</span>
          {w.is_current ? (
            <Chip
              size="sm"
              variant="flat"
              color="success"
              classNames={{ base: 'h-5 min-h-5 px-1.5', content: 'text-[10px] font-normal' }}
            >
              本周
            </Chip>
          ) : null}
        </div>
        {w.range_line ? (
          <span className="text-xs text-default-400">{w.range_line}</span>
        ) : null}
      </div>
    ),
  }))

  return (
    <SearchableMultiSelect
      items={items}
      selectedKeys={selectedKeys}
      onSelectionChange={onSelectionChange}
      allLabel="全部周次"
      ariaLabel="周次"
      className={className}
      isDisabled={isDisabled}
    />
  )
}
