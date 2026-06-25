'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Button,
  Card,
  CardBody,
  Chip,
  Spinner,
  Switch,
  Tab,
  Tabs,
  Textarea,
  addToast,
  cn,
} from '@heroui/react'
import { Icon } from '@iconify/react'
import { WeekHalfDayPopoverField } from '@/components/common/week-half-day-picker'
import {
  deleteWeeklyReportItemAction,
  loadWeeklyReportEditorAction,
  submitWeeklyReportForApprovalAction,
  upsertWeeklyReportItemAction,
} from '@/modules/weekly/report-editor/actions'
import {
  WEEKLY_REPORT_STATUS_COLOR,
  WEEKLY_REPORT_STATUS_LABEL,
} from '@/constants/weekly-report-status'
import { isNowAfterWeekDeadline } from '@/modules/weekly/lib/week-deadline'
import { formatWeekRangeLine, formatWeekTitleZh } from '@/modules/weekly/lib/week-display'
import { randomClientId } from '@/core/random-client-id'
import {
  mergeWeekHalfSlotsUnique,
  parseWeekHalfSlotKey,
  weekHalfSlotToKey,
  weekHalfSlotsToWorkDays,
  type WeekHalfSlot,
} from '@/modules/weekly/lib/weekly-report-work-slots'
import type { WeeklyReportEditorPayload } from '@/modules/weekly/types'

type ItemKind = 'work' | 'plan'

type FillRow = {
  clientKey: string
  id?: string
  item_type: ItemKind
  item_desc: string
  work_slots: WeekHalfSlot[]
  file_ids: string[]
  files: { id: string; file_name: string }[]
}

const AUTOSAVE_DEBOUNCE_MS = 1200

function toFillRow(
  it: WeeklyReportEditorPayload['items'][0],
  kind: ItemKind
): FillRow {
  return {
    clientKey: it.id,
    id: it.id,
    item_type: kind,
    item_desc: it.item_desc ?? '',
    work_slots: [...it.work_slots],
    file_ids: [...it.file_ids],
    files: [...it.files],
  }
}

function newEmptyRow(kind: ItemKind): FillRow {
  return {
    clientKey: `new-${randomClientId()}`,
    item_type: kind,
    item_desc: '',
    work_slots: [],
    file_ids: [],
    files: [],
  }
}

function splitRowsFromPayload(
  items: WeeklyReportEditorPayload['items']
): { work: FillRow[]; plan: FillRow[] } {
  const work = items
    .filter((i) => i.item_type === 'work')
    .map((i) => toFillRow(i, 'work'))
  const plan = items
    .filter((i) => i.item_type === 'plan')
    .map((i) => toFillRow(i, 'plan'))
  return {
    work: work.length ? work : [newEmptyRow('work')],
    plan: plan.length ? plan : [newEmptyRow('plan')],
  }
}

function disabledSlotsForRow(
  rows: FillRow[],
  currentKey: string
): WeekHalfSlot[] {
  const keys = new Set<string>()
  for (const r of rows) {
    if (r.clientKey === currentKey) continue
    for (const s of r.work_slots) {
      keys.add(weekHalfSlotToKey(s))
    }
  }
  const out: WeekHalfSlot[] = []
  for (const k of keys) {
    const p = parseWeekHalfSlotKey(k)
    if (p) out.push(p)
  }
  return out
}

function isRowComplete(row: FillRow): boolean {
  return row.item_desc.trim().length > 0 && row.work_slots.length > 0
}

/** 无任何填写（可忽略的空行） */
function isRowEmpty(row: FillRow, section: 'work' | 'plan'): boolean {
  if (row.work_slots.length > 0 || row.item_desc.trim()) return false
  if (section === 'work' && row.file_ids.length > 0) return false
  return true
}

/** 可提交：要么填完整，要么整行留空 */
function isRowValidForSubmit(row: FillRow, section: 'work' | 'plan'): boolean {
  return isRowComplete(row) || isRowEmpty(row, section)
}

function rowSnapshot(row: FillRow): string {
  const keys = row.work_slots.map(weekHalfSlotToKey).sort().join(',')
  const ids =
    row.item_type === 'work' ? [...row.file_ids].sort().join(',') : ''
  return `${row.item_desc.trim()}|${keys}|${ids}|${row.id ?? ''}`
}

export interface WeeklyReportFillFormProps {
  initialPayload: WeeklyReportEditorPayload
  returnToHref: string
}

export default function WeeklyReportFillForm({
  initialPayload,
}: WeeklyReportFillFormProps) {
  const router = useRouter()
  const [payload, setPayload] = useState(initialPayload)
  const [workRows, setWorkRows] = useState<FillRow[]>(() =>
    splitRowsFromPayload(initialPayload.items).work
  )
  const [planRows, setPlanRows] = useState<FillRow[]>(() =>
    splitRowsFromPayload(initialPayload.items).plan
  )
  const [savingKeys, setSavingKeys] = useState<Set<string>>(() => new Set())
  const savingRef = useRef<Set<string>>(new Set())
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  /** 开启后提交时不再要求下周计划，服务端会删除已保存的计划项 */
  const [noPlanNextWeek, setNoPlanNextWeek] = useState(false)
  const [selectedTab, setSelectedTab] = useState<'work' | 'plan'>('work')

  const lastSavedRef = useRef<Map<string, string>>(new Map())
  const debounceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  )
  const rowsRef = useRef({ workRows, planRows })
  rowsRef.current = { workRows, planRows }

  const week = payload.week
  const nextWeek = payload.next_week
  const project = payload.project
  const reportId = payload.report.id
  const reportStatus = payload.report.status

  const showOverdueBadge = useMemo(
    () =>
      payload.report.is_overdue || isNowAfterWeekDeadline(week.deadline),
    [payload.report.is_overdue, week.deadline]
  )

  const totalWorkDaysThisWeek = useMemo(() => {
    const slots = workRows.flatMap((r) => r.work_slots)
    return weekHalfSlotsToWorkDays(slots)
  }, [workRows])

  const weekRangeLine = formatWeekRangeLine(week.start_date, week.end_date)

  const reloadPayload = useCallback(async () => {
    const res = await loadWeeklyReportEditorAction({
      projectId: project.id,
      weekCode: week.week_code,
    })
    if (res.success && res.data) {
      setPayload(res.data)
      const sp = splitRowsFromPayload(res.data.items)
      setWorkRows(sp.work)
      setPlanRows(sp.plan)
      lastSavedRef.current.clear()
      for (const r of [...sp.work, ...sp.plan]) {
        if (r.id && isRowComplete(r)) {
          lastSavedRef.current.set(r.clientKey, rowSnapshot(r))
        }
      }
    }
  }, [project.id, week.week_code])

  const setRow = useCallback(
    (clientKey: string, patch: Partial<FillRow>, section: 'work' | 'plan') => {
      const setFn = section === 'work' ? setWorkRows : setPlanRows
      setFn((prev) =>
        prev.map((r) => (r.clientKey === clientKey ? { ...r, ...patch } : r))
      )
    },
    []
  )

  const findRow = useCallback((clientKey: string): FillRow | null => {
    const { workRows: w, planRows: p } = rowsRef.current
    return [...w, ...p].find((r) => r.clientKey === clientKey) ?? null
  }, [])

  const saveRowInternal = useCallback(
    async (
      clientKey: string,
      section: 'work' | 'plan',
      opts: { silent?: boolean } = {}
    ): Promise<boolean> => {
      const row = findRow(clientKey)
      if (!row || !isRowComplete(row)) return false

      const snap = rowSnapshot(row)
      if (snap === lastSavedRef.current.get(clientKey)) return true

      if (savingRef.current.has(clientKey)) return false
      savingRef.current.add(clientKey)
      setSavingKeys((prev) => new Set(prev).add(clientKey))

      let res: Awaited<ReturnType<typeof upsertWeeklyReportItemAction>>
      try {
        res = await upsertWeeklyReportItemAction({
          reportId,
          itemId: row.id,
          item_type: row.item_type,
          item_desc: row.item_desc.trim(),
          work_slots: row.work_slots,
          file_ids: row.item_type === 'work' ? row.file_ids : [],
        })
      } finally {
        savingRef.current.delete(clientKey)
        setSavingKeys((prev) => {
          const next = new Set(prev)
          next.delete(clientKey)
          return next
        })
      }

      if (!res.success) {
        if (!opts.silent) {
          addToast({
            title: '保存失败',
            description: res.message,
            color: 'danger',
          })
        }
        return false
      }

      const newId = res.data?.id
      if (newId && newId !== row.id) {
        setRow(clientKey, { id: newId, clientKey: newId }, section)
        lastSavedRef.current.delete(clientKey)
        const merged = { ...row, id: newId, clientKey: newId }
        lastSavedRef.current.set(newId, rowSnapshot(merged))
      } else {
        lastSavedRef.current.set(clientKey, rowSnapshot(row))
      }

      if (!opts.silent) {
        addToast({ title: '已保存', color: 'success' })
      }
      return true
    },
    [findRow, reportId, setRow]
  )

  useEffect(() => {
    const all = [...workRows, ...planRows]
    const currentKeys = new Set(all.map((r) => r.clientKey))
    for (const key of debounceTimersRef.current.keys()) {
      if (!currentKeys.has(key)) {
        const old = debounceTimersRef.current.get(key)
        if (old) clearTimeout(old)
        debounceTimersRef.current.delete(key)
      }
    }
    for (const row of all) {
      const key = row.clientKey
      const section = row.item_type === 'work' ? 'work' : 'plan'
      if (section === 'plan' && noPlanNextWeek) {
        const t = debounceTimersRef.current.get(key)
        if (t) {
          clearTimeout(t)
          debounceTimersRef.current.delete(key)
        }
        continue
      }
      if (!isRowComplete(row)) {
        const t = debounceTimersRef.current.get(key)
        if (t) {
          clearTimeout(t)
          debounceTimersRef.current.delete(key)
        }
        continue
      }

      const snap = rowSnapshot(row)
      if (snap === lastSavedRef.current.get(key)) {
        const t = debounceTimersRef.current.get(key)
        if (t) {
          clearTimeout(t)
          debounceTimersRef.current.delete(key)
        }
        continue
      }
      const existing = debounceTimersRef.current.get(key)
      if (existing) clearTimeout(existing)

      const t = setTimeout(() => {
        debounceTimersRef.current.delete(key)
        void saveRowInternal(key, section, { silent: true })
      }, AUTOSAVE_DEBOUNCE_MS)
      debounceTimersRef.current.set(key, t)
    }
  }, [workRows, planRows, noPlanNextWeek, saveRowInternal])

  useEffect(() => {
    const timers = debounceTimersRef.current
    return () => {
      for (const t of timers.values()) {
        clearTimeout(t)
      }
      timers.clear()
    }
  }, [])

  useLayoutEffect(() => {
    const sp = splitRowsFromPayload(initialPayload.items)
    for (const r of [...sp.work, ...sp.plan]) {
      if (r.id && isRowComplete(r)) {
        lastSavedRef.current.set(r.clientKey, rowSnapshot(r))
      }
    }
  }, [initialPayload.items])

  const clearAllTimers = useCallback(() => {
    for (const t of debounceTimersRef.current.values()) {
      clearTimeout(t)
    }
    debounceTimersRef.current.clear()
  }, [])

  const flushDirtyRows = useCallback(async (opts?: { skipPlan?: boolean }) => {
    clearAllTimers()
    const planPart = opts?.skipPlan ? [] : rowsRef.current.planRows
    const all = [...rowsRef.current.workRows, ...planPart]
    for (const row of all) {
      if (!isRowComplete(row)) continue
      const snap = rowSnapshot(row)
      if (snap === lastSavedRef.current.get(row.clientKey)) continue
      const section = row.item_type === 'work' ? 'work' : 'plan'
      await saveRowInternal(row.clientKey, section, { silent: true })
    }
  }, [clearAllTimers, saveRowInternal])

  const deleteRow = async (row: FillRow, section: 'work' | 'plan') => {
    const setFn = section === 'work' ? setWorkRows : setPlanRows
    if (!row.id) {
      setFn((prev) => {
        const next = prev.filter((r) => r.clientKey !== row.clientKey)
        if (next.length === 0) return [newEmptyRow(row.item_type)]
        return next
      })
      lastSavedRef.current.delete(row.clientKey)
      return
    }
    setDeletingKey(row.clientKey)
    const res = await deleteWeeklyReportItemAction({
      reportId,
      itemId: row.id,
    })
    setDeletingKey(null)
    if (!res.success) {
      addToast({
        title: '删除失败',
        description: res.message,
        color: 'danger',
      })
      return
    }
    addToast({ title: '已删除', color: 'success' })
    await reloadPayload()
  }

  const handleSubmit = async () => {
    const badWork = workRows.find((r) => !isRowValidForSubmit(r, 'work'))
    if (badWork) {
      addToast({
        title: '请填写完整',
        description: '每条本周事项须同时选择工作日期并填写工作内容',
        color: 'warning',
      })
      setSelectedTab('work')
      return
    }
    const hasWorkContent = workRows.some((r) => isRowComplete(r))
    if (!hasWorkContent) {
      addToast({
        title: '请填写本周工作',
        description: '至少需一条已保存的本周工作记录（含工作日期与内容）',
        color: 'warning',
      })
      setSelectedTab('work')
      return
    }
    if (!noPlanNextWeek) {
      const badPlan = planRows.find((r) => !isRowValidForSubmit(r, 'plan'))
      if (badPlan) {
        addToast({
          title: '请填写完整',
          description: '每条下周计划须同时选择日期并填写说明，或开启「下周无计划」',
          color: 'warning',
        })
        setSelectedTab('plan')
        return
      }
      const hasPlanContent = planRows.some((r) => isRowComplete(r))
      if (!hasPlanContent) {
        addToast({
          title: '请填写下周计划',
          description:
            '至少需一条已填写的下周计划；若下周无计划请开启上方开关',
          color: 'warning',
        })
        setSelectedTab('plan')
        return
      }
    }

    setSubmitting(true)
    try {
      await flushDirtyRows({ skipPlan: noPlanNextWeek })
      if (!noPlanNextWeek) {
        await reloadPayload()
      }
      const res = await submitWeeklyReportForApprovalAction({
        reportId,
        noNextWeekPlan: noPlanNextWeek,
      })
      if (!res.success) {
        addToast({
          title: '提交失败',
          description: res.message,
          color: 'danger',
        })
        return
      }
      addToast({ title: '已提交审批', color: 'success' })
      router.push(`/weekly/reports/${reportId}`)
    } finally {
      setSubmitting(false)
    }
  }

  const renderItemRow = (
    row: FillRow,
    index: number,
    section: 'work' | 'plan',
    rangeStartIso: string,
    rangeEndIso: string,
    rows: FillRow[]
  ) => {
    const disabledSlots = mergeWeekHalfSlotsUnique(
      disabledSlotsForRow(rows, row.clientKey),
      section === 'work'
        ? payload.used_slots_other_reports_work
        : payload.used_slots_other_reports_plan
    )
    const synced =
      isRowComplete(row) &&
      rowSnapshot(row) === lastSavedRef.current.get(row.clientKey)
    const saving = savingKeys.has(row.clientKey)

    return (
      <Card
        key={row.clientKey}
        shadow="none"
        className="border border-default-200/90"
      >
        <CardBody className="gap-3 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-foreground">
              {section === 'work' ? '工作内容' : '工作计划'} {index + 1}
            </span>
            <div className="flex items-center gap-2">
              {saving ? (
                <span className="flex items-center gap-1 text-xs text-default-400">
                  <Spinner size="sm" className="size-3" />
                  保存中
                </span>
              ) : synced && isRowComplete(row) ? (
                <span className="text-xs text-primary">已保存</span>
              ) : null}
              <Button
                size="sm"
                variant="light"
                color="danger"
                className="min-w-0 px-2"
                isDisabled={rows.length === 1 && !row.id}
                isLoading={deletingKey === row.clientKey}
                onPress={() => void deleteRow(row, section)}
              >
                删除
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1 sm:gap-3">
            <span className="w-full shrink-0 text-xs font-medium text-default-600 sm:w-14">
              工作日期
              <span className="text-danger">*</span>
            </span>
            <WeekHalfDayPopoverField
              rangeStartIso={rangeStartIso}
              rangeEndIso={rangeEndIso}
              value={row.work_slots}
              onChange={(next) =>
                setRow(row.clientKey, { work_slots: next }, section)
              }
              disabledSlots={disabledSlots}
              emptyLabel="未选"
              className="min-w-[8rem] flex-1"
              pickerAriaLabel={
                section === 'work' ? '本周工作半天' : '下周计划半天'
              }
              aria-label="选择工作半天"
            />
            {/* <span className="text-xs tabular-nums text-default-500">
              {daysLabel}
            </span> */}
          </div>

          <Textarea
            label={
              section === 'work' ? (
                <>
                  工作内容<span className="text-danger">*</span>
                </>
              ) : (
                <>
                  计划说明<span className="text-danger">*</span>
                </>
              )
            }
            labelPlacement="outside"
            placeholder={
              section === 'work'
                ? '具体工作内容…'
                : '计划工作内容…'
            }
            variant="bordered"
            size="sm"
            minRows={2}
            value={row.item_desc}
            onValueChange={(v) =>
              setRow(row.clientKey, { item_desc: v }, section)
            }
            onBlur={() => {
              const sectionKind = row.item_type === 'work' ? 'work' : 'plan'
              void saveRowInternal(row.clientKey, sectionKind, {
                silent: true,
              })
            }}
          />

        </CardBody>
      </Card>
    )
  }


  return (
    <div className="space-y-4 pb-24 sm:pb-8">
      <div className="sticky top-0 z-20 -mx-4 border-b border-default-200/80 bg-background/95 px-4 py-3 backdrop-blur-sm sm:static sm:mx-0 sm:rounded-xl sm:border sm:border-default-200/80 sm:py-3.5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-2">
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
              {project.project_name ?? project.project_no ?? '—'}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-default-600">
              <Chip
                size="sm"
                variant="flat"
                color={WEEKLY_REPORT_STATUS_COLOR[reportStatus]}
              >
                {WEEKLY_REPORT_STATUS_LABEL[reportStatus]}
              </Chip>
              {showOverdueBadge ? (
                <>
                  <span className="text-default-400" aria-hidden>
                    ·
                  </span>
                  <Chip size="sm" variant="flat" color="warning">
                    逾期填写
                  </Chip>
                </>
              ) : null}
              <span className="text-default-400" aria-hidden>
                ·
              </span>
              <span className="font-medium text-foreground">
                {formatWeekTitleZh(week.week_code)}
                {weekRangeLine ? (
                  <span className="ms-1 font-normal text-default-500">
                    （{weekRangeLine}）
                  </span>
                ) : null}
              </span>
              <span className="text-default-400" aria-hidden>
                ·
              </span>
              <span className="tabular-nums text-default-600">
                工作天数：{' '}
                <span className="font-semibold text-primary">
                  {Number.isInteger(totalWorkDaysThisWeek)
                    ? String(totalWorkDaysThisWeek)
                    : totalWorkDaysThisWeek.toFixed(1)}
                </span>{' '}
                <span className="text-foreground">天</span>
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              as={Link}
              href="/weekly/reports"
              variant="flat"
              size="sm"
              className="text-default-600"
            >
              返回
            </Button>
            <Button
              color="primary"
              size="sm"
              className="hidden sm:inline-flex"
              isLoading={submitting}
              onPress={() => void handleSubmit()}
            >
              提交
            </Button>
          </div>
        </div>
      </div>

      <p className="text-xs text-default-500">
        至少一条完整的本周工作记录和一条下周工作计划；若确实无计划，请在「下周计划」中开启「下周无计划」。
      </p>

      <Tabs
        aria-label="周报分区"
        selectedKey={selectedTab}
        onSelectionChange={(k) => setSelectedTab(k as 'work' | 'plan')}
        color="primary"
        variant="solid"
        classNames={{
          panel: 'pt-4',
        }}
      >
        <Tab key="work" title="本周工作">
          <div className="space-y-3">
            {workRows.map((row, i) =>
              renderItemRow(
                row,
                i,
                'work',
                week.start_date,
                week.end_date,
                workRows
              )
            )}
            <Button
              size="sm"
              variant="bordered"
              className="w-full border-dashed"
              startContent={<Icon icon="lucide:plus" className="size-4" />}
              onPress={() =>
                setWorkRows((prev) => [...prev, newEmptyRow('work')])
              }
            >
              添加本周事项
            </Button>
          </div>
        </Tab>
        <Tab key="plan" title="下周计划">
          <div className="mb-3 flex flex-col gap-2 rounded-lg border border-default-200/80 bg-default-50/60 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">下周无计划</p>
              <p className="text-xs text-default-500">
                开启后不要求「至少一条完整下周计划」；提交时会删除已保存的计划项
              </p>
            </div>
            <Switch
              size="sm"
              isSelected={noPlanNextWeek}
              onValueChange={setNoPlanNextWeek}
              aria-label="下周无计划"
            />
          </div>
          <div
            className={cn(
              'space-y-3',
              noPlanNextWeek && 'pointer-events-none opacity-50'
            )}
          >
            {planRows.map((row, i) =>
              renderItemRow(
                row,
                i,
                'plan',
                nextWeek.start_date,
                nextWeek.end_date,
                planRows
              )
            )}
            <Button
              size="sm"
              variant="bordered"
              className="w-full border-dashed"
              isDisabled={noPlanNextWeek}
              startContent={<Icon icon="lucide:plus" className="size-4" />}
              onPress={() =>
                setPlanRows((prev) => [...prev, newEmptyRow('plan')])
              }
            >
              添加下周计划
            </Button>
          </div>
        </Tab>
      </Tabs>

      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-30 border-t border-default-200 bg-content1/95 p-4 backdrop-blur-sm sm:hidden'
        )}
      >
        <Button
          color="primary"
          fullWidth
          size="lg"
          isLoading={submitting}
          onPress={() => void handleSubmit()}
        >
          提交审批
        </Button>
      </div>

    </div>
  )
}
