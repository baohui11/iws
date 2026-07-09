'use client'

import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  Chip,
  Button,
} from '@heroui/react'
import { Icon } from '@iconify/react'
import { WEEKLY_PROJECTS_PAGE_SIZE } from '@/constants/weekly-projects-space'
import {
  loadMyWeeklyProjectsAction,
} from '@/modules/weekly/projects/actions'
import { showErrorToast, showResultError } from '@/core/client/errors'
import type { DepartmentNode } from '@/modules/org/departments/repo'
import {
  PROJECT_STATUS_LABEL,
} from '@/constants/project-status'
import { PROJECT_STAGE_LABEL } from '@/constants/project-stage'
import {
  flattenDepartmentTree,
  formatDepartmentPathLabel,
} from '@/modules/org/departments/display'
import ProjectListFilters from '@/modules/projects/components/project-list-filters'
import {
  buildWeeklyProjectDetailHref,
  buildWeeklyProjectsSearchParams,
  parseWeeklyProjectsSearchParams,
  type WeeklyProjectsUrlState,
} from '@/modules/weekly/lib/weekly-projects-url'
import type { WeeklyProjectListItem } from '@/modules/projects/types'

const STATUS_COLOR: Record<
  string,
  'success' | 'warning' | 'primary' | 'default' | 'danger'
> = {
  进行中: 'success',
  预结项: 'warning',
  已结项: 'primary',
  终止: 'danger',
  已关闭: 'default',
}

interface WeeklyProjectsListProps {
  initialProjects: WeeklyProjectListItem[]
  initialTotal: number
  departments: DepartmentNode[]
  /** 与地址栏初始一致（服务端解析） */
  initialListState: WeeklyProjectsUrlState
  canSwitchScope: boolean
}

function ProjectTableEntryIcon({ href }: { href: string }) {
  return (
    <Link
      href={href}
      aria-label="进入项目"
      className="inline-flex size-9 items-center justify-center rounded-full text-primary-500 transition-colors hover:bg-primary/10 hover:text-primary"
    >
      <Icon icon="lucide:arrow-up-right" className="size-[18px]" aria-hidden />
    </Link>
  )
}

export default function WeeklyProjectsList({
  initialProjects,
  initialTotal,
  departments,
  initialListState,
  canSwitchScope,
}: WeeklyProjectsListProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [rows, setRows] = useState(initialProjects)
  const [total, setTotal] = useState(initialTotal)
  const [keyword, setKeyword] = useState(initialListState.q)
  const [departmentId, setDepartmentId] = useState(initialListState.dept)
  const [stageFilter, setStageFilter] = useState(initialListState.stage)
  const [statusFilter, setStatusFilter] = useState(initialListState.status)
  const [onlyParticipating, setOnlyParticipating] = useState(initialListState.mine)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const loadingMoreRef = useRef(false)
  const listRequestSeqRef = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomSentinelRef = useRef<HTMLDivElement>(null)

  /** 本组件内 router.replace 触发的 searchParams 变化，避免与下面 effect 重复请求 */
  const skipSearchParamsEffect = useRef(false)
  const isFirstSearchParamsEffect = useRef(true)

  const flatDepartments = useMemo(
    () => flattenDepartmentTree(departments),
    [departments]
  )

  const fetchFromStart = useCallback(
    async (
      kw: string,
      dept: string,
      stage: string,
      status: string,
      memberOnly: boolean
    ) => {
      const seq = ++listRequestSeqRef.current
      setIsLoading(true)
      try {
        const result = await loadMyWeeklyProjectsAction({
          offset: 0,
          pageSize: WEEKLY_PROJECTS_PAGE_SIZE,
          keyword: kw.trim() || undefined,
          departmentFilterId: dept.trim() || undefined,
          projectStageFilter: stage.trim() || undefined,
          projectStatusFilter: status.trim() || undefined,
          onlyParticipating: memberOnly,
        })
        if (seq !== listRequestSeqRef.current) return
        if (!result.success) {
          showResultError(result, '加载失败')
        } else if (result.data) {
          setRows(result.data.projects)
          setTotal(result.data.total)
        }
      } catch (error) {
        if (seq === listRequestSeqRef.current) {
          showErrorToast({ title: '加载失败', error })
        }
      } finally {
        if (seq === listRequestSeqRef.current) {
          setIsLoading(false)
        }
      }
    },
    []
  )

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || isLoading) return
    if (rows.length >= total) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    try {
      const result = await loadMyWeeklyProjectsAction({
        offset: rows.length,
        pageSize: WEEKLY_PROJECTS_PAGE_SIZE,
        keyword: keyword.trim() || undefined,
        departmentFilterId: departmentId.trim() || undefined,
        projectStageFilter: stageFilter.trim() || undefined,
        projectStatusFilter: statusFilter.trim() || undefined,
        onlyParticipating,
      })
      if (!result.success) {
        showResultError(result, '加载失败')
      } else if (result.data) {
        setRows((prev) => {
          const seen = new Set(prev.map((r) => r.id))
          const next = result.data.projects.filter((p) => !seen.has(p.id))
          return [...prev, ...next]
        })
        setTotal(result.data.total)
      }
    } catch (error) {
      showErrorToast({ title: '加载失败', error })
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [
    departmentId,
    isLoading,
    keyword,
    onlyParticipating,
    rows.length,
    stageFilter,
    statusFilter,
    total,
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

  /** 列表高度不足一屏时补齐后续页 */
  useEffect(() => {
    const root = scrollRef.current
    if (!root || isLoading || loadingMore || rows.length >= total) return
    if (root.scrollHeight > root.clientHeight + 8) return
    // 内容不满一屏时自动补页（哨兵驱动）
    void loadMore()
  }, [isLoading, loadMore, loadingMore, rows.length, total])

  const replaceListUrl = useCallback(
    (next: WeeklyProjectsUrlState) => {
      skipSearchParamsEffect.current = true
      const p = buildWeeklyProjectsSearchParams(next)
      const qs = p.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router]
  )

  const searchParamsKey = searchParams.toString()

  useEffect(() => {
    if (isFirstSearchParamsEffect.current) {
      isFirstSearchParamsEffect.current = false
      return
    }
    if (skipSearchParamsEffect.current) {
      skipSearchParamsEffect.current = false
      return
    }
    const parsed = parseWeeklyProjectsSearchParams(searchParams)
    // 浏览器前进/后退时按 URL 同步筛选态（外部 store 同步）
    setKeyword(parsed.q)
    setDepartmentId(parsed.dept)
    setStageFilter(parsed.stage)
    setStatusFilter(parsed.status)
    const mine = canSwitchScope ? parsed.mine : true
    setOnlyParticipating(mine)
    void fetchFromStart(parsed.q, parsed.dept, parsed.stage, parsed.status, mine)
  }, [canSwitchScope, searchParamsKey, searchParams, fetchFromStart])

  const buildDetailHref = useCallback(
    (projectId: string) =>
      buildWeeklyProjectDetailHref(projectId, pathname, searchParams),
    [pathname, searchParams]
  )

  const handleSearch = () => {
    const next: WeeklyProjectsUrlState = {
      q: keyword,
      dept: departmentId,
      stage: stageFilter,
      status: statusFilter,
      mine: onlyParticipating,
    }
    replaceListUrl(next)
    void fetchFromStart(
      keyword,
      departmentId,
      stageFilter,
      statusFilter,
      onlyParticipating
    )
  }

  const skipFirstKeyword = useRef(true)
  useEffect(() => {
    if (skipFirstKeyword.current) {
      skipFirstKeyword.current = false
      return
    }
    const timer = window.setTimeout(() => {
      handleSearch()
    }, 300)
    return () => window.clearTimeout(timer)
    // 只让关键词输入触发防抖刷新；下拉和范围切换走各自的即时刷新。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword])

  const emptyMessage = isLoading ? '加载中…' : '暂无数据'

  return (
    <div className="space-y-6">
      <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center">
        <ProjectListFilters
          className="flex-1"
          departments={departments}
          departmentId={departmentId}
          keyword={keyword}
          projectStage={stageFilter}
          projectStatus={statusFilter}
          isDisabled={isLoading}
          onKeywordChange={setKeyword}
          onKeywordSubmit={handleSearch}
          onDepartmentChange={(id) => {
            const next: WeeklyProjectsUrlState = {
              q: keyword,
              dept: id,
              stage: stageFilter,
              status: statusFilter,
              mine: onlyParticipating,
            }
            setDepartmentId(id)
            replaceListUrl(next)
            void fetchFromStart(
              keyword,
              id,
              stageFilter,
              statusFilter,
              onlyParticipating
            )
          }}
          onProjectStageChange={(stage) => {
            const next: WeeklyProjectsUrlState = {
              q: keyword,
              dept: departmentId,
              stage,
              status: statusFilter,
              mine: onlyParticipating,
            }
            setStageFilter(stage)
            replaceListUrl(next)
            void fetchFromStart(
              keyword,
              departmentId,
              stage,
              statusFilter,
              onlyParticipating
            )
          }}
          onProjectStatusChange={(s) => {
            const next: WeeklyProjectsUrlState = {
              q: keyword,
              dept: departmentId,
              stage: stageFilter,
              status: s,
              mine: onlyParticipating,
            }
            setStatusFilter(s)
            replaceListUrl(next)
            void fetchFromStart(
              keyword,
              departmentId,
              stageFilter,
              s,
              onlyParticipating
            )
          }}
        />

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {canSwitchScope ? (
          <div className="flex h-10 shrink-0 overflow-hidden rounded-medium border border-default-200 bg-default-50/80 p-0.5">
            {[
              { key: true, label: '我参与' },
              { key: false, label: '可查看' },
            ].map((option) => (
              <Button
                key={String(option.key)}
                size="sm"
                variant={onlyParticipating === option.key ? 'solid' : 'light'}
                color={onlyParticipating === option.key ? 'primary' : 'default'}
                className="h-8 rounded-small px-3"
                onPress={() => {
                  const v = option.key
                  const next: WeeklyProjectsUrlState = {
                    q: keyword,
                    dept: departmentId,
                    stage: stageFilter,
                    status: statusFilter,
                    mine: v,
                  }
                  setOnlyParticipating(v)
                  replaceListUrl(next)
                  void fetchFromStart(
                    keyword,
                    departmentId,
                    stageFilter,
                    statusFilter,
                    v
                  )
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>
          ) : null}
          <Button
            as={Link}
            href="/weekly/projects/add"
            color="primary"
            size="sm"
            className="font-medium"
            startContent={<Icon icon="lucide:plus" className="size-4" aria-hidden />}
          >
            添加项目
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-default-500">
          <Icon icon="lucide:loader-2" className="size-4 animate-spin" />
          加载中…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-default-200 bg-default-50/50 py-14 text-center text-sm text-default-500 dark:bg-default-100/5">
          暂无数据
        </div>
      ) : (
      <div
        ref={scrollRef}
        className="max-h-[min(70vh,720px)] overflow-y-auto overflow-x-hidden pr-0.5"
      >
        <Table
          aria-label="我的项目"
          classNames={{ wrapper: 'overflow-x-auto' }}
        >
          <TableHeader>
            <TableColumn>项目编号</TableColumn>
            <TableColumn>项目名称</TableColumn>
            <TableColumn>部门</TableColumn>
            <TableColumn>可填阶段</TableColumn>
            <TableColumn>状态</TableColumn>
            <TableColumn>项目角色</TableColumn>
            <TableColumn align="end">操作</TableColumn>
          </TableHeader>
          <TableBody emptyContent={emptyMessage}>
            {rows.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <span className="font-mono text-sm">{item.project_no ?? '—'}</span>
                </TableCell>
                <TableCell>{item.project_name ?? '—'}</TableCell>
                <TableCell className="max-w-[240px] truncate">
                  {formatDepartmentPathLabel(
                    item.department_id,
                    flatDepartments,
                    item.department_name
                  )}
                </TableCell>
                <TableCell>
                  {item.is_participating && item.my_project_stages.length ? (
                    <div className="flex flex-wrap gap-1">
                      {item.my_project_stages.map((stage) => (
                        <Chip
                          key={stage}
                          size="sm"
                          variant="flat"
                          color={stage === '实施阶段' ? 'primary' : 'warning'}
                        >
                          {PROJECT_STAGE_LABEL[
                            stage as keyof typeof PROJECT_STAGE_LABEL
                          ] ?? stage}
                        </Chip>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-default-400">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {item.project_status ? (
                    <Chip
                      size="sm"
                      variant="flat"
                      color={STATUS_COLOR[item.project_status] ?? 'default'}
                    >
                      {PROJECT_STATUS_LABEL[item.project_status] ??
                        item.project_status}
                    </Chip>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell>
                  {item.is_participating ? (
                    <Chip size="sm" variant="flat" color="primary">
                      {item.my_project_role
                        ? item.my_project_role
                        : '成员'}
                    </Chip>
                  ) : (
                    <span className="text-xs text-default-400">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <ProjectTableEntryIcon href={buildDetailHref(item.id)} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

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
