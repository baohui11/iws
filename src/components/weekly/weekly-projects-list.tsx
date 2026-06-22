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
  Switch,
  Input,
  Button,
  Select,
  SelectItem,
  Tooltip,
  addToast,
  cn,
} from '@heroui/react'
import { Icon } from '@iconify/react'
import { WEEKLY_PROJECTS_PAGE_SIZE } from '@/constants/weekly-projects-space'
import { listMyWeeklyProjects } from '@/actions/weekly/projects.action'
import type { DepartmentNode } from '@/lib/db/admin/departments'
import {
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_VALUES,
} from '@/constants/project-status'
import {
  flattenDepartmentTree,
  formatDepartmentPathLabel,
} from '@/lib/utils/department-display'
import {
  buildWeeklyProjectDetailHref,
  buildWeeklyProjectsSearchParams,
  parseWeeklyProjectsSearchParams,
  type WeeklyProjectsUrlState,
} from '@/lib/utils/weekly-projects-url'
import { PROJECT_ROLE_LABEL } from '@/constants/project-roles'
import type { WeeklyProjectListItem } from '@/types/project'

/** 与 admin DepartmentTreeSelect / 原 WeeklyDepartmentSelect 一致：根 + 一层子部门 */
function flattenDepartmentOptionsForWeekly(
  departments: DepartmentNode[],
  parentName?: string
): Array<{ id: string; fullName: string }> {
  const result: Array<{ id: string; fullName: string }> = []
  for (const dept of departments) {
    const fullName = parentName ? `${parentName} / ${dept.name}` : dept.name
    result.push({ id: dept.id, fullName })
    if (dept.children?.length) {
      for (const child of dept.children) {
        result.push({
          id: child.id,
          fullName: `${fullName} / ${child.name}`,
        })
      }
    }
  }
  return result
}

type ViewMode = 'table' | 'cards'

const STATUS_COLOR: Record<
  string,
  'success' | 'warning' | 'primary' | 'default' | 'danger'
> = {
  active: 'success',
  preparing: 'warning',
  completed: 'primary',
  archived: 'default',
  suspended: 'danger',
}

interface WeeklyProjectsListProps {
  initialProjects: WeeklyProjectListItem[]
  initialTotal: number
  departments: DepartmentNode[]
  /** 与地址栏初始一致（服务端解析） */
  initialListState: WeeklyProjectsUrlState
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

function ProjectCardEntryLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="group/entry inline-flex items-center gap-1.5 text-[13px] font-medium text-primary transition-opacity hover:opacity-90"
    >
      <span className="border-b border-transparent pb-px transition-[border-color] group-hover/entry:border-primary/55">
        进入项目
      </span>
      <Icon
        icon="lucide:arrow-up-right"
        className="size-4 shrink-0 opacity-80 transition-[transform,opacity] group-hover/entry:translate-x-px group-hover/entry:-translate-y-px group-hover/entry:opacity-100"
        aria-hidden
      />
    </Link>
  )
}

function WeeklyProjectCard({
  item,
  deptLabel,
  detailHref,
}: {
  item: WeeklyProjectListItem
  deptLabel: string
  detailHref: string
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-default-200/90 bg-content1 p-5 transition-[border-color,background-color] hover:border-primary/30 hover:bg-content1">
      <div className="flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 min-w-0 flex-1 text-[15px] font-semibold leading-snug tracking-tight text-foreground">
          {item.project_name ?? '—'}
        </h3>
        {item.project_status ? (
          <Chip
            size="sm"
            variant="flat"
            color={STATUS_COLOR[item.project_status] ?? 'default'}
            className="h-6 shrink-0 px-2 text-xs"
          >
            {PROJECT_STATUS_LABEL[item.project_status] ?? item.project_status}
          </Chip>
        ) : null}
      </div>

      <p className="mt-2.5 font-mono text-[11px] tabular-nums text-default-400">
        {item.project_no ?? '—'}
      </p>

      <div className="mt-3 flex min-h-[1.75rem] flex-wrap items-center gap-x-3 gap-y-2">
        <span className="min-w-0 flex-1 text-sm leading-relaxed text-default-500 line-clamp-2">
          {deptLabel}
        </span>
        {item.is_participating ? (
          <Chip
            size="sm"
            variant="flat"
            color="primary"
            className="h-6 shrink-0 px-2 text-xs"
          >
            {item.my_project_role
              ? PROJECT_ROLE_LABEL[item.my_project_role]
              : '成员'}
          </Chip>
        ) : null}
      </div>

      <div className="mt-auto border-t border-default-100 pt-4">
        <ProjectCardEntryLink href={detailHref} />
      </div>
    </div>
  )
}

export default function WeeklyProjectsList({
  initialProjects,
  initialTotal,
  departments,
  initialListState,
}: WeeklyProjectsListProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [rows, setRows] = useState(initialProjects)
  const [total, setTotal] = useState(initialTotal)
  const [keyword, setKeyword] = useState(initialListState.q)
  const [departmentId, setDepartmentId] = useState(initialListState.dept)
  const [statusFilter, setStatusFilter] = useState(initialListState.status)
  const [onlyParticipating, setOnlyParticipating] = useState(initialListState.mine)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>(initialListState.view)

  const loadingMoreRef = useRef(false)
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
    async (kw: string, dept: string, status: string, memberOnly: boolean) => {
      setIsLoading(true)
      const result = await listMyWeeklyProjects({
        offset: 0,
        pageSize: WEEKLY_PROJECTS_PAGE_SIZE,
        keyword: kw.trim() || undefined,
        departmentFilterId: dept.trim() || undefined,
        projectStatusFilter: status.trim() || undefined,
        onlyParticipating: memberOnly,
      })
      setIsLoading(false)
      if (result.success && result.data) {
        setRows(result.data.projects)
        setTotal(result.data.total)
      } else {
        addToast({
          title: '加载失败',
          description: result.message ?? '获取项目列表失败',
          color: 'danger',
        })
      }
    },
    []
  )

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || isLoading) return
    if (rows.length >= total) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    const result = await listMyWeeklyProjects({
      offset: rows.length,
      pageSize: WEEKLY_PROJECTS_PAGE_SIZE,
      keyword: keyword.trim() || undefined,
      departmentFilterId: departmentId.trim() || undefined,
      projectStatusFilter: statusFilter.trim() || undefined,
      onlyParticipating,
    })
    loadingMoreRef.current = false
    setLoadingMore(false)
    if (result.success && result.data) {
      setRows((prev) => {
        const seen = new Set(prev.map((r) => r.id))
        const next = result.data!.projects.filter((p) => !seen.has(p.id))
        return [...prev, ...next]
      })
      setTotal(result.data.total)
    } else {
      addToast({
        title: '加载失败',
        description: result.message ?? '获取项目列表失败',
        color: 'danger',
      })
    }
  }, [
    departmentId,
    isLoading,
    keyword,
    onlyParticipating,
    rows.length,
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
    setViewMode(parsed.view)
    setKeyword(parsed.q)
    setDepartmentId(parsed.dept)
    setStatusFilter(parsed.status)
    setOnlyParticipating(parsed.mine)
    void fetchFromStart(parsed.q, parsed.dept, parsed.status, parsed.mine)
  }, [searchParamsKey, searchParams, fetchFromStart])

  const buildDetailHref = useCallback(
    (projectId: string) =>
      buildWeeklyProjectDetailHref(projectId, pathname, searchParams),
    [pathname, searchParams]
  )

  const departmentOptions = useMemo(
    () => flattenDepartmentOptionsForWeekly(departments),
    [departments]
  )

  const departmentSelectItems = useMemo(
    () => [
      { key: 'all', label: '全部部门' },
      ...departmentOptions.map((o) => ({
        key: o.id,
        label: o.fullName,
      })),
    ],
    [departmentOptions]
  )

  const statusSelectItems = useMemo(
    () => [
      { key: 'all', label: '全部状态' },
      ...PROJECT_STATUS_VALUES.map((v) => ({
        key: v,
        label: PROJECT_STATUS_LABEL[v],
      })),
    ],
    []
  )

  const handleSearch = () => {
    const next: WeeklyProjectsUrlState = {
      view: viewMode,
      q: keyword,
      dept: departmentId,
      status: statusFilter,
      mine: onlyParticipating,
    }
    replaceListUrl(next)
    void fetchFromStart(keyword, departmentId, statusFilter, onlyParticipating)
  }

  const emptyMessage = isLoading ? '加载中…' : '暂无数据'

  return (
    <div className="space-y-6">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <Input
          placeholder="编号、名称、客户、合同号"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          variant="bordered"
          startContent={
            <Icon icon="lucide:search" className="size-4 text-default-400" aria-hidden />
          }
          className="min-w-[180px] max-w-xs shrink-0"
          size="sm"
          classNames={{ inputWrapper: 'h-10 min-h-10' }}
        />

        <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-2">
          <Select
            placeholder="部门"
            size="sm"
            variant="bordered"
            className="w-full min-w-0 max-w-full"
            classNames={{
              base: 'w-full min-w-0 max-w-full',
              mainWrapper: 'w-full min-w-0',
              trigger: 'h-10 min-h-10 w-full min-w-0',
            }}
            items={departmentSelectItems}
            selectedKeys={
              departmentId.trim()
                ? new Set([departmentId])
                : new Set(['all'])
            }
            onSelectionChange={(keys) => {
              const k = [...keys][0] as string | undefined
              if (!k) return
              const id = k === 'all' ? '' : k
              const next: WeeklyProjectsUrlState = {
                view: viewMode,
                q: keyword,
                dept: id,
                status: statusFilter,
                mine: onlyParticipating,
              }
              setDepartmentId(id)
              replaceListUrl(next)
              void fetchFromStart(keyword, id, statusFilter, onlyParticipating)
            }}
            isDisabled={isLoading}
            aria-label="部门"
          >
            {(item) => (
              <SelectItem key={item.key} textValue={item.label}>
                {item.label}
              </SelectItem>
            )}
          </Select>

          <Select
            placeholder="项目状态"
            size="sm"
            variant="bordered"
            className="w-full min-w-0 max-w-full"
            classNames={{
              base: 'w-full min-w-0 max-w-full',
              mainWrapper: 'w-full min-w-0',
              trigger: 'h-10 min-h-10 w-full min-w-0',
            }}
            items={statusSelectItems}
            selectedKeys={
              statusFilter.trim()
                ? new Set([statusFilter])
                : new Set(['all'])
            }
            onSelectionChange={(keys) => {
              const k = [...keys][0] as string | undefined
              if (!k) return
              const s = k === 'all' ? '' : k
              const next: WeeklyProjectsUrlState = {
                view: viewMode,
                q: keyword,
                dept: departmentId,
                status: s,
                mine: onlyParticipating,
              }
              setStatusFilter(s)
              replaceListUrl(next)
              void fetchFromStart(keyword, departmentId, s, onlyParticipating)
            }}
            isDisabled={isLoading}
            aria-label="项目状态"
          >
            {(item) => (
              <SelectItem key={item.key} textValue={item.label}>
                {item.label}
              </SelectItem>
            )}
          </Select>
        </div>

        <Button
          color="primary"
          size="sm"
          onPress={handleSearch}
          isLoading={isLoading}
          startContent={
            !isLoading && <Icon icon="lucide:search" className="size-4" aria-hidden />
          }
        >
          搜索
        </Button>

        <Tooltip content="仅展示我参与的项目" delay={200} placement="top">
          <Switch
            size="sm"
            isSelected={onlyParticipating}
            onValueChange={(v) => {
              const next: WeeklyProjectsUrlState = {
                view: viewMode,
                q: keyword,
                dept: departmentId,
                status: statusFilter,
                mine: v,
              }
              setOnlyParticipating(v)
              replaceListUrl(next)
              void fetchFromStart(keyword, departmentId, statusFilter, v)
            }}
          >
            仅我参与
          </Switch>
        </Tooltip>

        <div
          className="ml-auto flex h-10 shrink-0 items-center gap-0 self-center overflow-hidden rounded-medium border border-default-200 bg-default-50/80 p-0 dark:bg-default-100/10"
          role="group"
          aria-label="展示形式"
        >
          <Tooltip content="卡片视图" delay={200} placement="top">
            <Button
              size="sm"
              isIconOnly
              variant={viewMode === 'cards' ? 'solid' : 'light'}
              color={viewMode === 'cards' ? 'primary' : 'default'}
              className="h-10 min-h-10 min-w-10 rounded-none"
              aria-label="卡片视图"
              onPress={() => {
                const next: WeeklyProjectsUrlState = {
                  view: 'cards',
                  q: keyword,
                  dept: departmentId,
                  status: statusFilter,
                  mine: onlyParticipating,
                }
                setViewMode('cards')
                replaceListUrl(next)
              }}
            >
              <Icon
                icon="lucide:layout-grid"
                className={cn(
                  'size-4',
                  viewMode === 'cards'
                    ? 'text-primary-foreground'
                    : 'text-default-500'
                )}
                aria-hidden
              />
            </Button>
          </Tooltip>
          <Tooltip content="表格视图" delay={200} placement="top">
            <Button
              size="sm"
              isIconOnly
              variant={viewMode === 'table' ? 'solid' : 'light'}
              color={viewMode === 'table' ? 'primary' : 'default'}
              className="h-10 min-h-10 min-w-10 rounded-none"
              aria-label="表格视图"
              onPress={() => {
                const next: WeeklyProjectsUrlState = {
                  view: 'table',
                  q: keyword,
                  dept: departmentId,
                  status: statusFilter,
                  mine: onlyParticipating,
                }
                setViewMode('table')
                replaceListUrl(next)
              }}
            >
              <Icon
                icon="lucide:table"
                className={cn(
                  'size-4',
                  viewMode === 'table'
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
          暂无数据
        </div>
      ) : (
      <div
        ref={scrollRef}
        className="max-h-[min(70vh,720px)] overflow-y-auto overflow-x-hidden pr-0.5"
      >
      {viewMode === 'table' ? (
        <Table
          aria-label="我的项目"
          classNames={{ wrapper: 'overflow-x-auto' }}
        >
          <TableHeader>
            <TableColumn>项目编号</TableColumn>
            <TableColumn>项目名称</TableColumn>
            <TableColumn>部门</TableColumn>
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
                        ? PROJECT_ROLE_LABEL[item.my_project_role]
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
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((item) => (
            <WeeklyProjectCard
              key={item.id}
              item={item}
              deptLabel={formatDepartmentPathLabel(
                item.department_id,
                flatDepartments,
                item.department_name
              )}
              detailHref={buildDetailHref(item.id)}
            />
          ))}
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
