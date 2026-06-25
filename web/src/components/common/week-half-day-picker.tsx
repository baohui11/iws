'use client'

import { memo, useCallback, useMemo, useState } from 'react'
import {
  Button,
  Card,
  CardBody,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@heroui/react'
import { Icon } from '@iconify/react'

const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const

export type WeekHalf = 'am' | 'pm'

/** 单个半天槽位（返回值、禁用列表均用此结构） */
export type WeekHalfSlot = {
  isoDate: string
  half: WeekHalf
}

/** 序列化键，仅在与外部字符串协议对接时使用 */
export type WeekHalfSlotKey = `${string}-${WeekHalf}`

function isValidIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

/** 自然日加天数，本地日历，返回 YYYY-MM-DD */
export function addCalendarDaysIso(isoDate: string, deltaDays: number): string {
  if (!isValidIsoDate(isoDate)) return isoDate
  const y = Number(isoDate.slice(0, 4))
  const m = Number(isoDate.slice(5, 7))
  const d = Number(isoDate.slice(8, 10))
  const dt = new Date(y, m - 1, d + deltaDays)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function makeWeekHalfSlot(isoDate: string, half: WeekHalf): WeekHalfSlot {
  return { isoDate, half }
}

export function weekHalfSlotToKey(s: WeekHalfSlot): WeekHalfSlotKey {
  return `${s.isoDate}-${s.half}` as WeekHalfSlotKey
}

/** 与 `weekHalfSlotToKey({ isoDate, half })` 等价 */
export function makeWeekHalfSlotKey(isoDate: string, half: WeekHalf): WeekHalfSlotKey {
  return weekHalfSlotToKey({ isoDate, half })
}

export function parseWeekHalfSlotKey(key: string): WeekHalfSlot | null {
  const m = /^(\d{4}-\d{2}-\d{2})-(am|pm)$/.exec(key.trim())
  if (!m) return null
  return { isoDate: m[1], half: m[2] as WeekHalf }
}

/**
 * 闭区间 [rangeStartIso, rangeEndIso] 内每个自然日，按先后排列（本地日历）。
 * 起始不必是周一；从起始日是周几就从周几开始展示。
 */
export function calendarDaysInclusive(rangeStartIso: string, rangeEndIso: string): string[] {
  if (!isValidIsoDate(rangeStartIso) || !isValidIsoDate(rangeEndIso)) return []
  if (rangeEndIso < rangeStartIso) return []
  const out: string[] = []
  let cur = rangeStartIso
  for (let guard = 0; guard < 400; guard++) {
    out.push(cur)
    if (cur === rangeEndIso) break
    cur = addCalendarDaysIso(cur, 1)
  }
  return out
}

/** 由周一日期生成当周 7 天 YYYY-MM-DD（周一 … 周日），等价于该周起止闭区间 */
export function weekDaysFromMonday(weekStartMondayIso: string): string[] {
  if (!isValidIsoDate(weekStartMondayIso)) return []
  const end = addCalendarDaysIso(weekStartMondayIso, 6)
  return calendarDaysInclusive(weekStartMondayIso, end)
}

/** 该自然日在本地星期下的「周一」…「周日」文案 */
export function weekdayLabelZhFromIso(isoDate: string): string {
  if (!isValidIsoDate(isoDate)) return '—'
  const y = Number(isoDate.slice(0, 4))
  const m = Number(isoDate.slice(5, 7))
  const d = Number(isoDate.slice(8, 10))
  const dt = new Date(y, m - 1, d)
  const day = dt.getDay()
  const mondayFirstIndex = day === 0 ? 6 : day - 1
  return WEEKDAY_LABELS[mondayFirstIndex]
}

function formatDayLabel(isoDate: string): string {
  if (!isValidIsoDate(isoDate)) return '—'
  const m = Number(isoDate.slice(5, 7))
  const d = Number(isoDate.slice(8, 10))
  return `${m}/${d}`
}

function slotsToKeySet(slots: readonly WeekHalfSlot[]): Set<string> {
  return new Set(slots.map(weekHalfSlotToKey))
}

function sortSlotsUnique(slots: Iterable<WeekHalfSlot>): WeekHalfSlot[] {
  const seen = new Set<string>()
  const out: WeekHalfSlot[] = []
  for (const s of slots) {
    const k = weekHalfSlotToKey(s)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(s)
  }
  return out.sort((a, b) => {
    if (a.isoDate !== b.isoDate) return a.isoDate.localeCompare(b.isoDate)
    return a.half === 'am' ? (b.half === 'am' ? 0 : -1) : 1
  })
}

/** 每个半天计 0.5 天 */
export function weekHalfSlotsToWorkDays(slots: readonly WeekHalfSlot[]): number {
  return slots.length * 0.5
}

/** 触发器等处展示用，如 `1.5 天` */
export function formatWeekHalfWorkDaysLabel(
  slots: readonly WeekHalfSlot[],
  emptyLabel = '0 天'
): string {
  if (slots.length === 0) return emptyLabel
  const n = weekHalfSlotsToWorkDays(slots)
  const text = Number.isInteger(n) ? String(n) : n.toFixed(1)
  return `${text} 天`
}

type WeekHalfSlotCellProps = {
  slotKey: WeekHalfSlotKey
  isSelected: boolean
  isSlotDisabled: boolean
  ariaLabel: string
  onPress: (slotKey: WeekHalfSlotKey) => void
}

const WeekHalfSlotCell = memo(function WeekHalfSlotCell({
  slotKey,
  isSelected,
  isSlotDisabled,
  ariaLabel,
  onPress,
}: WeekHalfSlotCellProps) {
  return (
    <Button
      type="button"
      radius="sm"
      isIconOnly
      aria-label={ariaLabel}
      isDisabled={isSlotDisabled}
      aria-pressed={isSelected}
      variant={isSlotDisabled ? 'flat' : isSelected ? 'solid' : 'bordered'}
      color={isSlotDisabled ? 'default' : isSelected ? 'primary' : 'default'}
      className={cn(
        'size-8 min-w-8 shrink-0 sm:size-9 sm:min-w-9',
        isSlotDisabled &&
          'border border-default-200 bg-default-100 text-default-400 !opacity-100'
      )}
      onPress={() => onPress(slotKey)}
    >
      <span className="sr-only">{ariaLabel}</span>
    </Button>
  )
})

export type WeekHalfDayPickerProps = {
  /** 展示区间起始日 YYYY-MM-DD（含） */
  rangeStartIso: string
  /** 展示区间结束日 YYYY-MM-DD（含），须 ≥ `rangeStartIso` */
  rangeEndIso: string
  value?: readonly WeekHalfSlot[]
  defaultValue?: readonly WeekHalfSlot[]
  onChange?: (next: WeekHalfSlot[]) => void
  disabledSlots?: readonly WeekHalfSlot[]
  className?: string
  /** 置于 Popover 等容器内：去掉卡片阴影与外边线 */
  embed?: boolean
  /** 仅展示 `value`，不可点选修改（适合详情页） */
  isReadOnly?: boolean
  isDisabled?: boolean
  'aria-label'?: string
}

/**
 * 按起止日期连续展示每天上/下午各一块，可点选；列顺序与日历一致，星期标题随当日实际周几变化。
 * 选中项为 `WeekHalfSlot[]`：`{ isoDate: 'YYYY-MM-DD', half: 'am' | 'pm' }`。
 */
export function WeekHalfDayPicker({
  rangeStartIso,
  rangeEndIso,
  value,
  defaultValue,
  onChange,
  disabledSlots = [],
  className,
  embed = false,
  isReadOnly = false,
  isDisabled = false,
  'aria-label': ariaLabel = '周半天选择',
}: WeekHalfDayPickerProps) {
  const days = useMemo(
    () => calendarDaysInclusive(rangeStartIso, rangeEndIso),
    [rangeStartIso, rangeEndIso]
  )

  const disabledKeys = useMemo(
    () => new Set(disabledSlots.map(weekHalfSlotToKey)),
    [disabledSlots]
  )

  const [uncontrolled, setUncontrolled] = useState<WeekHalfSlot[]>(() =>
    sortSlotsUnique(defaultValue ?? [])
  )

  const selectedKeys = useMemo(() => {
    const list = value !== undefined ? value : uncontrolled
    return slotsToKeySet(list)
  }, [value, uncontrolled])

  const toggle = useCallback(
    (slot: WeekHalfSlot) => {
      if (isDisabled || isReadOnly) return
      const key = weekHalfSlotToKey(slot)
      if (disabledKeys.has(key)) return

      const applyToggle = (base: readonly WeekHalfSlot[]) => {
        const nextKeys = slotsToKeySet(base)
        if (nextKeys.has(key)) nextKeys.delete(key)
        else nextKeys.add(key)
        return sortSlotsUnique(
          [...nextKeys].map((k) => parseWeekHalfSlotKey(k)).filter(Boolean) as WeekHalfSlot[]
        )
      }

      if (value !== undefined) {
        onChange?.(applyToggle(value))
        return
      }
      setUncontrolled((prev) => {
        const nextSlots = applyToggle(prev)
        onChange?.(nextSlots)
        return nextSlots
      })
    },
    [disabledKeys, isDisabled, isReadOnly, onChange, value]
  )

  const onSlotPress = useCallback(
    (slotKey: WeekHalfSlotKey) => {
      const parsed = parseWeekHalfSlotKey(slotKey)
      if (parsed) toggle(parsed)
    },
    [toggle]
  )

  return (
    <Card
      role="group"
      aria-label={ariaLabel}
      shadow={embed ? 'none' : 'sm'}
      className={cn(
        'bg-content1',
        embed ? 'w-fit max-w-full border-0' : 'border border-default-200/80',
        isReadOnly && 'cursor-default',
        className
      )}
    >
      <CardBody className="gap-3 p-3">
        <div
          className={cn('max-w-full overflow-x-auto pb-0.5', isReadOnly && 'pointer-events-none select-none')}
          inert={isReadOnly ? true : undefined}
        >
          <div
            className="grid w-full gap-1.5 sm:gap-2"
            style={{
              gridTemplateColumns: `repeat(${Math.max(days.length, 1)}, minmax(2.25rem, 1fr))`,
              ...(days.length === 0
                ? {}
                : { minWidth: `max(100%, ${days.length * 2.25}rem)` }),
            }}
          >
            {days.map((isoDate) => {
              const wd = weekdayLabelZhFromIso(isoDate)
              return (
                <div
                  key={isoDate}
                  className="flex min-w-0 flex-col gap-1"
                  aria-label={`${wd} ${formatDayLabel(isoDate)}`}
                >
                  <div className="text-center">
                    <div className="text-[11px] font-medium text-default-500">{wd}</div>
                    <div className="text-xs font-semibold text-foreground">{formatDayLabel(isoDate)}</div>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    {(['am', 'pm'] as const).map((half) => {
                      const slot = makeWeekHalfSlot(isoDate, half)
                      const slotKey = weekHalfSlotToKey(slot)
                      const isOn = selectedKeys.has(slotKey)
                      const slotDisabled = isDisabled || disabledKeys.has(slotKey)
                      const halfLabel = half === 'am' ? '上午' : '下午'
                      return (
                        <WeekHalfSlotCell
                          key={slotKey}
                          slotKey={slotKey}
                          isSelected={isOn}
                          isSlotDisabled={slotDisabled}
                          ariaLabel={`${wd} ${formatDayLabel(isoDate)} ${halfLabel}`}
                          onPress={onSlotPress}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        {days.length === 0 ? (
          <p className="text-center text-xs text-danger">
            请传入合法的起止日期（YYYY-MM-DD），且起始日不晚于截止日
          </p>
        ) : null}
      </CardBody>
    </Card>
  )
}

export type WeekHalfDayPopoverFieldProps = Omit<WeekHalfDayPickerProps, 'className' | 'embed'> & {
  /** 触发器一行 */
  className?: string
  /** 展开面板内周选择器的 className */
  pickerClassName?: string
  /** 内层 `WeekHalfDayPicker` 的 `aria-label` */
  pickerAriaLabel?: string
  /** 未选任何半天时触发器文案，默认 `0 天` */
  emptyLabel?: string
  placement?:
    | 'top'
    | 'bottom'
    | 'left'
    | 'right'
    | 'top-start'
    | 'top-end'
    | 'bottom-start'
    | 'bottom-end'
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** 触发器按钮 `aria-label` */
  'aria-label'?: string
}

/**
 * 点击展开周半天选择；触发器展示合计天数（每半天 0.5 天），不可直接输入。
 */
export function WeekHalfDayPopoverField({
  rangeStartIso,
  rangeEndIso,
  value,
  defaultValue,
  onChange,
  disabledSlots,
  pickerClassName,
  pickerAriaLabel = '周半天选择',
  className,
  isReadOnly = false,
  isDisabled = false,
  emptyLabel = '0 天',
  placement = 'bottom-start',
  isOpen,
  onOpenChange,
  'aria-label': ariaLabel = '选择工作天数',
}: WeekHalfDayPopoverFieldProps) {
  const [internal, setInternal] = useState<WeekHalfSlot[]>(() =>
    sortSlotsUnique(defaultValue ?? [])
  )

  const slots = value !== undefined ? value : internal

  const handleChange = useCallback(
    (next: WeekHalfSlot[]) => {
      if (value === undefined) setInternal(next)
      onChange?.(next)
    },
    [value, onChange]
  )

  const summary = useMemo(
    () => formatWeekHalfWorkDaysLabel(slots, emptyLabel),
    [slots, emptyLabel]
  )

  return (
    <Popover
      placement={placement}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      classNames={{
        /** 勿设固定宽度：周网格较窄，否则会两侧留空 */
        content: 'w-fit min-w-0 max-w-[min(100vw-2rem,36rem)] p-0',
      }}
    >
      <PopoverTrigger>
        <Button
          variant="bordered"
          className={cn('h-10 min-w-[10rem] justify-between gap-2 px-3', className)}
          isDisabled={isDisabled}
          aria-label={ariaLabel}
          endContent={
            <Icon icon="lucide:chevron-down" className="size-4 shrink-0 text-default-400" aria-hidden />
          }
        >
          <span className="min-w-0 truncate text-left text-sm font-medium text-foreground">
            {summary}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <WeekHalfDayPicker
          rangeStartIso={rangeStartIso}
          rangeEndIso={rangeEndIso}
          value={slots}
          onChange={handleChange}
          disabledSlots={disabledSlots}
          isReadOnly={isReadOnly}
          isDisabled={isDisabled}
          aria-label={pickerAriaLabel}
          embed
          className={pickerClassName}
        />
      </PopoverContent>
    </Popover>
  )
}
