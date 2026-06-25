'use client'

import { useMemo } from 'react'
import { Select, SelectItem } from '@heroui/react'
import type { Selection } from '@heroui/react'
import type { WeekOption } from '@/modules/weekly/types'
import { compareWeekCode } from '@/modules/weekly/lib/iso-week'

function selectionToOneKey(s: Selection): string {
  if (s === 'all') return ''
  const k = Array.from(s)[0]
  return k != null ? String(k) : ''
}

interface WeekRangeSelectsProps {
  weekOptions: WeekOption[]
  weekFrom: string
  weekTo: string
  onChange: (next: { weekFrom: string; weekTo: string }) => void
  isDisabled?: boolean
  /** @deprecated 保留兼容；现用内部 flex 包裹双周 +「至」 */
  wrapperClassName?: string
}

const selectClass = 'w-[10rem] min-w-[10rem] max-w-[10rem] shrink-0'

export default function WeekRangeSelects({
  weekOptions,
  weekFrom,
  weekTo,
  onChange,
  isDisabled,
  wrapperClassName,
}: WeekRangeSelectsProps) {
  /** 本周起往前：最新周在前（降序） */
  const sortedDesc = useMemo(
    () =>
      [...weekOptions].sort((a, b) =>
        compareWeekCode(b.week_code, a.week_code)
      ),
    [weekOptions]
  )

  /** 截止周：不得早于起始周；选项随起始周变，仅含 week >= weekFrom，同样降序 */
  const endOptionsDesc = useMemo(() => {
    if (!weekFrom) return sortedDesc
    return sortedDesc.filter(
      (w) => compareWeekCode(weekFrom, w.week_code) <= 0
    )
  }, [sortedDesc, weekFrom])

  const setFrom = (keys: Selection) => {
    const nextFrom = selectionToOneKey(keys)
    if (!nextFrom) return
    if (compareWeekCode(nextFrom, weekTo) > 0) {
      onChange({ weekFrom: nextFrom, weekTo: nextFrom })
    } else {
      onChange({ weekFrom: nextFrom, weekTo })
    }
  }

  const setTo = (keys: Selection) => {
    const nextTo = selectionToOneKey(keys)
    if (!nextTo) return
    if (compareWeekCode(weekFrom, nextTo) > 0) {
      onChange({ weekFrom: nextTo, weekTo: nextTo })
    } else {
      onChange({ weekFrom, weekTo: nextTo })
    }
  }

  const body = (
    <>
      <Select
        size="md"
        variant="bordered"
        className={selectClass}
        selectedKeys={weekFrom ? new Set([weekFrom]) : new Set()}
        onSelectionChange={setFrom}
        isDisabled={isDisabled}
        disallowEmptySelection
        aria-label="起始周"
      >
        {sortedDesc.map((w) => (
          <SelectItem key={w.week_code} textValue={w.title_zh}>
            <div className="flex flex-col gap-0.5">
              <span>{w.title_zh}</span>
              {w.range_line ? (
                <span className="text-xs text-default-400">{w.range_line}</span>
              ) : null}
            </div>
          </SelectItem>
        ))}
      </Select>
      <span
        className="shrink-0 px-0.5 text-sm text-default-500 select-none"
        aria-hidden
      >
        至
      </span>
      <Select
        size="md"
        variant="bordered"
        className={selectClass}
        selectedKeys={weekTo ? new Set([weekTo]) : new Set()}
        onSelectionChange={setTo}
        isDisabled={isDisabled || endOptionsDesc.length === 0}
        disallowEmptySelection
        aria-label="截止周"
      >
        {endOptionsDesc.map((w) => (
          <SelectItem key={w.week_code} textValue={w.title_zh}>
            <div className="flex flex-col gap-0.5">
              <span>{w.title_zh}</span>
              {w.range_line ? (
                <span className="text-xs text-default-400">{w.range_line}</span>
              ) : null}
            </div>
          </SelectItem>
        ))}
      </Select>
    </>
  )

  if (wrapperClassName === 'contents') {
    return body
  }

  return (
    <div
      className={
        wrapperClassName ??
        'flex shrink-0 flex-nowrap items-center gap-1'
      }
    >
      {body}
    </div>
  )
}
