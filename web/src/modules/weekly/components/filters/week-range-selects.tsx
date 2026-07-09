'use client'

import { useMemo } from 'react'
import type { WeekOption } from '@/modules/weekly/types'
import { compareWeekCode } from '@/modules/weekly/lib/iso-week'
import WeekSearchSelect from '@/components/common/week-search-select'

interface WeekRangeSelectsProps {
  weekOptions: WeekOption[]
  weekFrom: string
  weekTo: string
  onChange: (next: { weekFrom: string; weekTo: string }) => void
  isDisabled?: boolean
  /** @deprecated 保留兼容；现用内部 flex 包裹双周 +「至」 */
  wrapperClassName?: string
  selectClassName?: string
}

const defaultSelectClass = 'w-[12rem] min-w-[12rem] max-w-[12rem] shrink-0'

export default function WeekRangeSelects({
  weekOptions,
  weekFrom,
  weekTo,
  onChange,
  isDisabled,
  wrapperClassName,
  selectClassName,
}: WeekRangeSelectsProps) {
  const selectClass = selectClassName ?? defaultSelectClass
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

  const setFrom = (nextFrom: string) => {
    if (!nextFrom) return
    if (compareWeekCode(nextFrom, weekTo) > 0) {
      onChange({ weekFrom: nextFrom, weekTo: nextFrom })
    } else {
      onChange({ weekFrom: nextFrom, weekTo })
    }
  }

  const setTo = (nextTo: string) => {
    if (!nextTo) return
    if (compareWeekCode(weekFrom, nextTo) > 0) {
      onChange({ weekFrom: nextTo, weekTo: nextTo })
    } else {
      onChange({ weekFrom, weekTo: nextTo })
    }
  }

  const body = (
    <>
      <WeekSearchSelect
        weekOptions={sortedDesc}
        value={weekFrom}
        onChange={setFrom}
        label=""
        placeholder="起始周"
        size="sm"
        className={selectClass}
        isDisabled={isDisabled}
      />
      <span
        className="shrink-0 px-0.5 text-sm text-default-500 select-none"
        aria-hidden
      >
        至
      </span>
      <WeekSearchSelect
        weekOptions={endOptionsDesc}
        value={weekTo}
        onChange={setTo}
        label=""
        placeholder="截止周"
        size="sm"
        className={selectClass}
        isDisabled={isDisabled || endOptionsDesc.length === 0}
      />
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
