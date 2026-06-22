'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button, Chip, addToast, cn } from '@heroui/react'
import { Icon } from '@iconify/react'
import { loadProjectWeeklyWeeks } from '@/actions/weekly/project-weekly.action'
import { WEEKLY_PROJECT_WEEKS_PAGE_SIZE } from '@/constants/weekly-reports-list'
import {
  WEEKLY_REPORT_STATUS_COLOR,
  WEEKLY_REPORT_STATUS_LABEL,
} from '@/constants/weekly-report-status'
import type {
  ProjectWeeklyWeekGroup,
  ProjectWeeklyWeeksPage,
} from '@/types/weekly-reports'

interface ProjectWeeklyReportsTabProps {
  projectId: string
  initial: ProjectWeeklyWeeksPage
}

export default function ProjectWeeklyReportsTab({
  projectId,
  initial,
}: ProjectWeeklyReportsTabProps) {
  const [weeks, setWeeks] = useState<ProjectWeeklyWeekGroup[]>(initial.weeks)
  const [totalWeeks, setTotalWeeks] = useState(initial.totalWeeks)
  const [loadingMore, setLoadingMore] = useState(false)

  const loadingMoreRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomSentinelRef = useRef<HTMLDivElement>(null)

  const loadedWeekCount = weeks.length
  const hasMore = loadedWeekCount < totalWeeks

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current) return
    if (!hasMore) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    const result = await loadProjectWeeklyWeeks({
      projectId,
      weekOffset: loadedWeekCount,
      weekLimit: WEEKLY_PROJECT_WEEKS_PAGE_SIZE,
    })
    loadingMoreRef.current = false
    setLoadingMore(false)
    if (result.success && result.data) {
      setWeeks((prev) => {
        const seen = new Set(prev.map((w) => w.week_code))
        const next = result.data!.weeks.filter((w) => !seen.has(w.week_code))
        return [...prev, ...next]
      })
      setTotalWeeks(result.data.totalWeeks)
    } else {
      addToast({
        title: '加载失败',
        description: result.message ?? '请稍后重试',
        color: 'danger',
      })
    }
  }, [hasMore, loadedWeekCount, projectId])

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
    if (!root || loadingMore || !hasMore) return
    if (root.scrollHeight > root.clientHeight + 8) return
    void loadMore()
  }, [hasMore, loadMore, loadingMore, weeks.length])

  return (
    <div className="space-y-4">
      {weeks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-default-200 bg-default-50/50 py-14 text-center text-sm text-default-500 dark:bg-default-100/5">
          暂无周报或「无工作」记录
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="max-h-[min(70vh,720px)] overflow-y-auto overflow-x-hidden pr-0.5"
        >
          <div className="space-y-4">
            {weeks.map((w) => {
              const isNoWorkOnly = w.is_no_work_week && w.reporters.length === 0
              const showTotalDays =
                !(w.is_no_work_week && w.total_work_days === 0)
              /** 无工作周不显示「周详情」；普通周保留 */
              const showWeekDetail = !w.is_no_work_week
              const showEmptyPlain = w.reporters.length === 0 && !w.is_no_work_week
              const headerDivider =
                w.reporters.length > 0 || showEmptyPlain

              return (
              <section
                key={w.week_code}
                className={cn(
                  'overflow-hidden rounded-2xl border bg-content1 p-5 transition-colors',
                  w.is_no_work_week
                    ? 'border-warning-300/60 hover:border-warning-400/50'
                    : 'border-default-200/90 hover:border-primary/20'
                )}
              >
                <header
                  className={cn(headerDivider && 'border-b border-default-100 pb-4', isNoWorkOnly && 'pb-0')}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold tracking-tight text-foreground">
                          {w.title_zh}
                        </h2>
                        {w.is_no_work_week ? (
                          <Chip
                            size="sm"
                            variant="flat"
                            color="warning"
                            classNames={{ base: 'h-7' }}
                          >
                            无工作周
                          </Chip>
                        ) : null}
                        {w.is_current ? (
                          <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                            本周
                          </span>
                        ) : null}
                      </div>
                      {w.range_line ? (
                        <p className="mt-1 text-xs text-default-400">{w.range_line}</p>
                      ) : null}
                    </div>
                    {showTotalDays || showWeekDetail ? (
                      <div className="flex shrink-0 flex-wrap items-center gap-3">
                        {showTotalDays ? (
                          <p className="text-sm text-default-600">
                            合计{' '}
                            <span className="font-semibold tabular-nums text-foreground">
                              {w.total_work_days}
                            </span>{' '}
                            天
                          </p>
                        ) : null}
                        {showWeekDetail ? (
                          <Button
                            as={Link}
                            href={`/weekly/projects/${projectId}/weeks/${encodeURIComponent(w.week_code)}`}
                            size="sm"
                            variant="flat"
                            color="primary"
                            className="font-medium"
                            endContent={
                              <Icon icon="lucide:chevron-right" className="size-4" />
                            }
                          >
                            周详情
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </header>
                {w.reporters.length === 0 ? (
                  showEmptyPlain ? (
                    <p className="py-6 text-center text-sm text-default-500">
                      暂无成员周报
                    </p>
                  ) : null
                ) : (
                  <ul className="divide-y divide-default-100">
                    {w.reporters.map((r) => (
                      <li
                        key={r.report_id}
                        className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-4"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground">{r.user_name}</p>
                          <p className="mt-1 text-xs text-default-500">
                            {r.work_days} 天
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
                            href={`/weekly/reports/${r.report_id}`}
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
                )}
              </section>
              )
            })}
          </div>

          {loadingMore ? (
            <div className="flex items-center justify-center gap-2 py-3 text-xs text-default-500">
              <Icon icon="lucide:loader-2" className="size-4 animate-spin" />
              加载更多…
            </div>
          ) : null}
          {hasMore && !loadingMore ? (
            <p
              className={cn(
                'py-2 text-center text-xs text-default-400',
                loadedWeekCount === 0 && 'hidden'
              )}
            >
              滚动到底部加载更多（已显示 {loadedWeekCount} / {totalWeeks} 周）
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
