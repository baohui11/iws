'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Button,
  Chip,
  Radio,
  RadioGroup,
} from '@heroui/react'
import { Icon } from '@iconify/react'
import { loadPmApprovalListAction } from '@/modules/weekly/reports/actions'
import { showResultError } from '@/core/client/errors'
import WeekMultiSelect from '@/modules/weekly/components/filters/week-multi-select'
import ProjectMultiSelect from '@/modules/weekly/components/filters/project-multi-select'
import { WEEKLY_REPORTS_PAGE_SIZE } from '@/constants/weekly-reports-list'
import type {
  ApprovalDoneFilter,
  MemberProjectOption,
  PmApprovalListRow,
  WeekOption,
} from '@/modules/weekly/types'
import {
  buildWeeklyApprovalsSearchParams,
  parseWeeklyApprovalsSearchParamsFromSearchParams,
  resolveEffectiveWeekCodes,
  type WeeklyApprovalsUrlState,
} from '@/modules/weekly/lib/weekly-reports-url'
import { formatWeekCodeLabelZh } from '@/modules/weekly/lib/iso-week'
import {
  WEEKLY_REPORT_STATUS_COLOR,
  WEEKLY_REPORT_STATUS_LABEL,
} from '@/constants/weekly-report-status'

interface MyApprovalsListProps {
  initialRows: PmApprovalListRow[]
  initialTotal: number
  pageSize?: number
  weekOptions: WeekOption[]
  pmProjects: MemberProjectOption[]
  initialUrlState: WeeklyApprovalsUrlState
}

const APPROVAL_FILTER_OPTIONS: {
  value: ApprovalDoneFilter
  label: string
}[] = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待审批' },
  { value: 'rejected', label: '已驳回' },
  { value: 'approved', label: '已通过' },
]

export default function MyApprovalsList({
  initialRows,
  initialTotal,
  pageSize = WEEKLY_REPORTS_PAGE_SIZE,
  weekOptions,
  pmProjects,
  initialUrlState,
}: MyApprovalsListProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [rows, setRows] = useState(initialRows)
  const [total, setTotal] = useState(initialTotal)
  const [approvalFilter, setApprovalFilter] = useState<ApprovalDoneFilter>(
    initialUrlState.approval
  )
  const [weekKeys, setWeekKeys] = useState<Set<string>>(
    () => new Set(initialUrlState.weeks)
  )
  const [projectKeys, setProjectKeys] = useState<Set<string>>(
    () => new Set(initialUrlState.projects)
  )
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const skipEffect = useRef(false)
  const firstEffect = useRef(true)
  const loadingMoreRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomSentinelRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(
    async (state: WeeklyApprovalsUrlState) => {
      setIsLoading(true)
      const result = await loadPmApprovalListAction({
        approvalFilter: state.approval,
        weekCodes: [...state.weeks],
        projectIds: [...state.projects],
        offset: 0,
        limit: pageSize,
      })
      setIsLoading(false)
    if (!result.success) {
      showResultError(result, '加载失败')
    } else if (result.data) {
      setRows(result.data.rows)
      setTotal(result.data.total)
    }
    },
    [pageSize]
  )

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || isLoading) return
    if (rows.length >= total) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    const result = await loadPmApprovalListAction({
      approvalFilter,
      weekCodes: [...weekKeys],
      projectIds: [...projectKeys],
      offset: rows.length,
      limit: pageSize,
    })
    loadingMoreRef.current = false
    setLoadingMore(false)
    if (!result.success) {
      showResultError(result, '加载失败')
    } else if (result.data) {
      setRows((prev) => {
        const seen = new Set(prev.map((r) => r.id))
        const next = result.data.rows.filter((r) => !seen.has(r.id))
        return [...prev, ...next]
      })
    }
  }, [approvalFilter, isLoading, pageSize, projectKeys, rows.length, total, weekKeys])

  useEffect(() => {
    const root = scrollRef.current
    const bottomEl = bottomSentinelRef.current
    if (!root || !bottomEl) return

    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0]
        if (!e?.isIntersecting) return
        void loadMore()
      },
      { root, rootMargin: '120px', threshold: 0 }
    )
    io.observe(bottomEl)
    return () => io.disconnect()
  }, [loadMore])

  useEffect(() => {
    const root = scrollRef.current
    if (!root || isLoading || loadingMore || rows.length >= total) return
    if (root.scrollHeight > root.clientHeight + 8) return
    // 内容不满一屏时自动补页（哨兵驱动）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMore()
  }, [isLoading, loadMore, loadingMore, rows.length, total])

  const replaceUrl = useCallback(
    (state: WeeklyApprovalsUrlState) => {
      skipEffect.current = true
      const p = buildWeeklyApprovalsSearchParams(state)
      const qs = p.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router]
  )

  const apply = (next: WeeklyApprovalsUrlState) => {
    setApprovalFilter(next.approval)
    setWeekKeys(new Set(next.weeks))
    setProjectKeys(new Set(next.projects))
    replaceUrl(next)
    void fetchData(next)
  }

  const searchKey = searchParams.toString()
  useEffect(() => {
    if (firstEffect.current) {
      firstEffect.current = false
      return
    }
    if (skipEffect.current) {
      skipEffect.current = false
      return
    }
    const parsed = parseWeeklyApprovalsSearchParamsFromSearchParams(
      searchParams
    )
    const effectiveWeeks = resolveEffectiveWeekCodes(
      weekOptions,
      parsed.hasWeeksInUrl,
      parsed.weeks
    )
    // 浏览器前进/后退时按 URL 同步筛选态（外部 store 同步）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setApprovalFilter(parsed.approval)
    setWeekKeys(new Set(effectiveWeeks))
    setProjectKeys(new Set(parsed.projects))
    void fetchData({
      approval: parsed.approval,
      weeks: effectiveWeeks,
      projects: parsed.projects,
      hasWeeksInUrl: parsed.hasWeeksInUrl,
    })
  }, [searchKey, searchParams, fetchData, weekOptions])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center">
        <RadioGroup
          orientation="horizontal"
          size="sm"
          value={approvalFilter}
          onValueChange={(v) => {
            const k = v as ApprovalDoneFilter
            apply({
              approval: k,
              weeks: [...weekKeys],
              projects: [...projectKeys],
              hasWeeksInUrl: true,
            })
          }}
          isDisabled={isLoading}
          aria-label="审批状态"
          classNames={{
            wrapper: 'flex flex-wrap gap-x-4 gap-y-2',
          }}
        >
          {APPROVAL_FILTER_OPTIONS.map((opt) => (
            <Radio key={opt.value} value={opt.value}>
              {opt.label}
            </Radio>
          ))}
        </RadioGroup>

        <WeekMultiSelect
          weekOptions={weekOptions}
          selectedKeys={weekKeys}
          onSelectionChange={(keys) =>
            apply({
              approval: approvalFilter,
              weeks: [...keys],
              projects: [...projectKeys],
              hasWeeksInUrl: true,
            })
          }
          isDisabled={isLoading}
        />

        <ProjectMultiSelect
          projects={pmProjects}
          selectedKeys={projectKeys}
          onSelectionChange={(keys) =>
            apply({
              approval: approvalFilter,
              weeks: [...weekKeys],
              projects: [...keys],
              hasWeeksInUrl: true,
            })
          }
          isDisabled={isLoading}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-default-500">
          <Icon icon="lucide:loader-2" className="size-4 animate-spin" />
          加载中…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-default-200 bg-default-50/50 py-14 text-center text-sm text-default-500 dark:bg-default-100/5">
          暂无记录
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="max-h-[min(70vh,720px)] overflow-y-auto overflow-x-hidden pr-0.5"
        >
          <ul className="divide-y divide-default-100 overflow-hidden rounded-xl border border-default-200/90 bg-content1">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 transition-colors hover:bg-default-50/80 dark:hover:bg-default-100/5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-sm tabular-nums text-default-500">
                      {formatWeekCodeLabelZh(r.week_code)}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {r.project_name ?? '—'}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-default-500">
                    填写人 {r.author_name}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Chip
                    size="sm"
                    variant="flat"
                    color={WEEKLY_REPORT_STATUS_COLOR[r.status]}
                    classNames={{ base: 'h-7' }}
                  >
                    {WEEKLY_REPORT_STATUS_LABEL[r.status]}
                  </Chip>
                  <Button
                    as={Link}
                    href={`/weekly/reports/${r.id}/review`}
                    size="sm"
                    color="primary"
                    variant="light"
                    className="font-medium"
                    endContent={
                      <Icon icon="lucide:chevron-right" className="size-4" />
                    }
                  >
                    审批详情
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {loadingMore ? (
            <div className="flex items-center justify-center gap-2 py-3 text-xs text-default-500">
              <Icon icon="lucide:loader-2" className="size-4 animate-spin" />
              加载更多…
            </div>
          ) : null}
          {rows.length < total && !loadingMore ? (
            <p className="py-2 text-center text-xs text-default-400">
              滚动到底部加载更多（已显示 {rows.length} / {total} 条）
            </p>
          ) : null}
          <div
            ref={bottomSentinelRef}
            className="h-px w-full shrink-0"
            aria-hidden
          />
        </div>
      )}
    </div>
  )
}
