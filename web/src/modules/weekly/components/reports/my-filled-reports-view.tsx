'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button, Chip, Tooltip, addToast, cn } from '@heroui/react'
import { Icon } from '@iconify/react'
import { loadMyFilledReportsAction } from '@/modules/weekly/reports/actions'
import ProjectHerouiMultiSelect from '@/modules/weekly/components/filters/project-heroui-multi-select'
import WeekRangeSelects from '@/modules/weekly/components/filters/week-range-selects'
import { WEEKLY_REPORTS_PAGE_SIZE } from '@/constants/weekly-reports-list'
import type {
  MemberProjectOption,
  MyFilledGroupView,
  MyFilledReportRow,
  WeekOption,
} from '@/modules/weekly/types'
import { compareWeekCode } from '@/modules/weekly/lib/iso-week'
import {
  buildWeeklyFilledSearchParams,
  deriveProjectIdsFromSelection,
  getDefaultMyReportsWeekRange,
  parseWeeklyFilledSearchParamsFromSearchParams,
  resolveMyReportsWeekCodes,
  type WeeklyFilledUrlState,
} from '@/modules/weekly/lib/weekly-reports-url'
import {
  WEEKLY_REPORT_STATUS_COLOR,
  WEEKLY_REPORT_STATUS_LABEL,
} from '@/constants/weekly-report-status'

interface MyFilledReportsViewProps {
  initialRows: MyFilledReportRow[]
  initialTotal: number
  pageSize?: number
  weekOptions: WeekOption[]
  memberProjects: MemberProjectOption[]
  initialUrlState: WeeklyFilledUrlState
}

function groupByWeek(rows: MyFilledReportRow[]) {
  const map = new Map<string, MyFilledReportRow[]>()
  for (const r of rows) {
    if (!map.has(r.week_code)) map.set(r.week_code, [])
    map.get(r.week_code)!.push(r)
  }
  return [...map.entries()].sort((a, b) =>
    compareWeekCode(b[0], a[0])
  )
}

function groupByProject(rows: MyFilledReportRow[]) {
  const map = new Map<string, MyFilledReportRow[]>()
  for (const r of rows) {
    const k = r.project_id
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(r)
  }
  return [...map.entries()].sort((a, b) => {
    const na = a[1][0]?.project_name ?? ''
    const nb = b[1][0]?.project_name ?? ''
    return na.localeCompare(nb, 'zh-CN')
  })
}

export default function MyFilledReportsView({
  initialRows,
  initialTotal,
  pageSize = WEEKLY_REPORTS_PAGE_SIZE,
  weekOptions,
  memberProjects,
  initialUrlState,
}: MyFilledReportsViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [rows, setRows] = useState(initialRows)
  const [total, setTotal] = useState(initialTotal)
  const defaultWeekRange = useMemo(
    () => getDefaultMyReportsWeekRange(weekOptions),
    [weekOptions]
  )

  const [view, setView] = useState<MyFilledGroupView>(initialUrlState.view)
  const [weekFrom, setWeekFrom] = useState(() =>
    initialUrlState.hasWeekRangeInUrl && initialUrlState.weekFrom
      ? initialUrlState.weekFrom
      : defaultWeekRange.weekFrom
  )
  const [weekTo, setWeekTo] = useState(() =>
    initialUrlState.hasWeekRangeInUrl && initialUrlState.weekTo
      ? initialUrlState.weekTo
      : defaultWeekRange.weekTo
  )
  const [projectKeys, setProjectKeys] = useState(
    () =>
      new Set(
        initialUrlState.hasProjectsInUrl ? initialUrlState.projects : []
      )
  )
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const skipEffect = useRef(false)
  const firstEffect = useRef(true)
  const loadingMoreRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomSentinelRef = useRef<HTMLDivElement>(null)

  const weekMeta = useMemo(() => {
    const m = new Map<string, WeekOption>()
    for (const w of weekOptions) m.set(w.week_code, w)
    return m
  }, [weekOptions])

  const buildFetchPayload = useCallback(
    (state: WeeklyFilledUrlState) => {
      const weekCodes = resolveMyReportsWeekCodes(weekOptions, {
        hasWeekRangeInUrl: state.hasWeekRangeInUrl,
        weekFrom: state.weekFrom,
        weekTo: state.weekTo,
      })
      const projectIds = deriveProjectIdsFromSelection(
        memberProjects,
        state.projects
      )
      return { weekCodes, projectIds }
    },
    [memberProjects, weekOptions]
  )

  const fetchData = useCallback(
    async (state: WeeklyFilledUrlState) => {
      setIsLoading(true)
      const { weekCodes, projectIds } = buildFetchPayload(state)
      const result = await loadMyFilledReportsAction({
        weekCodes,
        projectIds,
        offset: 0,
        limit: pageSize,
      })
      setIsLoading(false)
      if (!result.success) {
        addToast({
          title: '加载失败',
          description: result.message ?? '获取周报失败',
          color: 'danger',
        })
      } else if (result.data) {
        setRows(result.data.rows)
        setTotal(result.data.total)
      }
    },
    [buildFetchPayload, pageSize]
  )

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || isLoading) return
    if (rows.length >= total) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    const state: WeeklyFilledUrlState = {
      view,
      weekFrom,
      weekTo,
      hasWeekRangeInUrl: true,
      projects: [...projectKeys],
      hasProjectsInUrl: projectKeys.size > 0,
    }
    const { weekCodes, projectIds } = buildFetchPayload(state)
    const result = await loadMyFilledReportsAction({
      weekCodes,
      projectIds,
      offset: rows.length,
      limit: pageSize,
    })
    loadingMoreRef.current = false
    setLoadingMore(false)
    if (!result.success) {
      addToast({
        title: '加载失败',
        description: result.message ?? '获取周报失败',
        color: 'danger',
      })
    } else if (result.data) {
      setRows((prev) => {
        const seen = new Set(prev.map((r) => r.id))
        const next = result.data.rows.filter((r) => !seen.has(r.id))
        return [...prev, ...next]
      })
    }
  }, [
    buildFetchPayload,
    projectKeys,
    isLoading,
    pageSize,
    rows.length,
    total,
    view,
    weekFrom,
    weekTo,
  ])

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

  /** 列表高度不足一屏时，底部哨兵会一直可见，用此补齐后续页 */
  useEffect(() => {
    const root = scrollRef.current
    if (!root || isLoading || loadingMore || rows.length >= total) return
    if (root.scrollHeight > root.clientHeight + 8) return
    // 内容不满一屏时自动补页（哨兵驱动）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMore()
  }, [isLoading, loadMore, loadingMore, rows.length, total])

  const replaceUrl = useCallback(
    (state: WeeklyFilledUrlState) => {
      skipEffect.current = true
      const p = buildWeeklyFilledSearchParams(state)
      const qs = p.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router]
  )

  const apply = (next: WeeklyFilledUrlState) => {
    setView(next.view)
    setWeekFrom(next.weekFrom)
    setWeekTo(next.weekTo)
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
    const parsed = parseWeeklyFilledSearchParamsFromSearchParams(searchParams)
    const dr = getDefaultMyReportsWeekRange(weekOptions)
    // 浏览器前进/后退时按 URL 同步筛选态（外部 store 同步）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView(parsed.view)
    setWeekFrom(
      parsed.hasWeekRangeInUrl && parsed.weekFrom
        ? parsed.weekFrom
        : dr.weekFrom
    )
    setWeekTo(
      parsed.hasWeekRangeInUrl && parsed.weekTo ? parsed.weekTo : dr.weekTo
    )
    setProjectKeys(
      new Set(parsed.hasProjectsInUrl ? parsed.projects : [])
    )
    void fetchData({
      view: parsed.view,
      weekFrom:
        parsed.hasWeekRangeInUrl && parsed.weekFrom
          ? parsed.weekFrom
          : dr.weekFrom,
      weekTo:
        parsed.hasWeekRangeInUrl && parsed.weekTo ? parsed.weekTo : dr.weekTo,
      hasWeekRangeInUrl: parsed.hasWeekRangeInUrl,
      projects: parsed.hasProjectsInUrl ? parsed.projects : [],
      hasProjectsInUrl: parsed.hasProjectsInUrl,
    })
  }, [searchKey, searchParams, fetchData, weekOptions])

  const byWeek = useMemo(() => groupByWeek(rows), [rows])
  const byProject = useMemo(() => groupByProject(rows), [rows])

  return (
    <div className="space-y-6">
      <div className="flex min-w-0 w-full flex-nowrap items-center gap-2">
        <div className="flex min-w-0 min-h-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto pb-0.5">
          <WeekRangeSelects
            weekOptions={weekOptions}
            weekFrom={weekFrom}
            weekTo={weekTo}
            onChange={({ weekFrom: wf, weekTo: wt }) =>
              apply({
                view,
                weekFrom: wf,
                weekTo: wt,
                hasWeekRangeInUrl: true,
                projects: [...projectKeys],
                hasProjectsInUrl: projectKeys.size > 0,
              })
            }
            isDisabled={isLoading}
            wrapperClassName="contents"
          />
          <ProjectHerouiMultiSelect
            projects={memberProjects}
            selectedKeys={projectKeys}
            onSelectionChange={(keys) =>
              apply({
                view,
                weekFrom,
                weekTo,
                hasWeekRangeInUrl: true,
                projects: [...keys],
                hasProjectsInUrl: keys.size > 0,
              })
            }
            isDisabled={isLoading}
          />
        </div>

        <div
          className="ml-auto flex h-10 shrink-0 items-center gap-0 overflow-hidden rounded-medium border border-default-200 bg-default-50/80 p-0 dark:bg-default-100/10"
          role="group"
          aria-label="展示方式"
        >
            <Tooltip content="按周次分组查看" delay={200} placement="top">
              <Button
                size="sm"
                isIconOnly
                variant={view === 'by_week' ? 'solid' : 'light'}
                color={view === 'by_week' ? 'primary' : 'default'}
                className="h-10 min-h-10 min-w-10 rounded-none"
                aria-label="按周次查看"
                onPress={() =>
                  apply({
                    view: 'by_week',
                    weekFrom,
                    weekTo,
                    hasWeekRangeInUrl: true,
                    projects: [...projectKeys],
                    hasProjectsInUrl: projectKeys.size > 0,
                  })
                }
              >
                <Icon
                  icon="lucide:calendar-range"
                  className={cn(
                    'size-4',
                    view === 'by_week'
                      ? 'text-primary-foreground'
                      : 'text-default-500'
                  )}
                  aria-hidden
                />
              </Button>
            </Tooltip>
            <Tooltip content="按项目分组查看" delay={200} placement="top">
              <Button
                size="sm"
                isIconOnly
                variant={view === 'by_project' ? 'solid' : 'light'}
                color={view === 'by_project' ? 'primary' : 'default'}
                className="h-10 min-h-10 min-w-10 rounded-none"
                aria-label="按项目查看"
                onPress={() =>
                  apply({
                    view: 'by_project',
                    weekFrom,
                    weekTo,
                    hasWeekRangeInUrl: true,
                    projects: [...projectKeys],
                    hasProjectsInUrl: projectKeys.size > 0,
                  })
                }
              >
                <Icon
                  icon="lucide:folder-kanban"
                  className={cn(
                    'size-4',
                    view === 'by_project'
                      ? 'text-primary-foreground'
                      : 'text-default-500'
                  )}
                  aria-hidden
                />
              </Button>
            </Tooltip>
          </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-default-500">
          <Icon icon="lucide:loader-2" className="size-4 animate-spin" />
          加载中…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-default-200 bg-default-50/50 py-14 text-center text-sm text-default-500 dark:bg-default-100/5">
          暂无周报记录
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="max-h-[min(70vh,720px)] overflow-y-auto overflow-x-hidden pr-0.5"
        >
          {view === 'by_week' ? (
        <div className="space-y-4">
          {byWeek.map(([weekCode, list]) => {
            const meta = weekMeta.get(weekCode)
            const totalDays = Math.round(
              list.reduce((s, r) => s + r.work_days, 0) * 10
            ) / 10
            return (
              <section
                key={weekCode}
                className="overflow-hidden rounded-2xl border border-default-200/90 bg-content1 p-5 transition-colors hover:border-primary/20"
              >
                <header className="border-b border-default-100 pb-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-semibold tracking-tight text-foreground">
                        {meta?.title_zh ?? weekCode}
                      </h2>
                      {meta?.range_line ? (
                        <p className="mt-1 text-xs text-default-400">
                          {meta.range_line}
                        </p>
                      ) : null}
                    </div>
                    <p className="text-sm text-default-600">
                      合计{' '}
                      <span className="font-semibold tabular-nums text-foreground">
                        {totalDays}
                      </span>{' '}
                      天
                    </p>
                  </div>
                </header>
                <ul className="divide-y divide-default-100">
                  {list.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">
                          {r.project_name ?? '—'}
                        </p>
                        <p className="mt-1 text-xs text-default-500">
                          {r.work_days} 天 · {r.item_count} 条事项
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
                          href={`/weekly/reports/${r.id}`}
                          size="sm"
                          variant="light"
                          color="primary"
                          className="font-medium"
                          endContent={
                            <Icon icon="lucide:chevron-right" className="size-4" />
                          }
                        >
                          查看
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
          ) : (
        <div className="space-y-4">
          {byProject.map(([projectId, list]) => {
            const name = list[0]?.project_name ?? projectId
            const totalDays =
              Math.round(list.reduce((s, r) => s + r.work_days, 0) * 10) / 10
            return (
              <section
                key={projectId}
                className="overflow-hidden rounded-2xl border border-default-200/90 bg-content1 p-5 transition-colors hover:border-primary/20"
              >
                <header className="border-b border-default-100 pb-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">
                      {name}
                    </h2>
                    <p className="text-sm text-default-600">
                      合计{' '}
                      <span className="font-semibold tabular-nums text-foreground">
                        {totalDays}
                      </span>{' '}
                      天
                    </p>
                  </div>
                </header>
                <ul className="divide-y divide-default-100">
                  {list
                    .slice()
                    .sort((a, b) => compareWeekCode(b.week_code, a.week_code))
                    .map((r) => {
                      const meta = weekMeta.get(r.week_code)
                      return (
                        <li
                          key={r.id}
                          className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-4"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-foreground">
                              {meta?.title_zh ?? r.week_code}
                            </p>
                            {meta?.range_line ? (
                              <p className="mt-0.5 text-xs text-default-400">
                                {meta.range_line}
                              </p>
                            ) : null}
                            <p className="mt-1 text-xs text-default-500">
                              {r.work_days} 天 · {r.item_count} 条事项
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
                              href={`/weekly/reports/${r.id}`}
                              size="sm"
                              variant="light"
                              color="primary"
                              className="font-medium"
                              endContent={
                                <Icon
                                  icon="lucide:chevron-right"
                                  className="size-4"
                                />
                              }
                            >
                              查看
                            </Button>
                          </div>
                        </li>
                      )
                    })}
                </ul>
              </section>
            )
          })}
        </div>
          )}
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
