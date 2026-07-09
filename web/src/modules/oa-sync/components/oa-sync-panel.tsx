'use client'

import { useMemo, useState, useTransition } from 'react'
import { Button, Chip, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react'
import { Icon } from '@iconify/react'
import { useRouter } from 'next/navigation'
import {
  AdminTablePagination,
  AdminTableSummary,
} from '@/components/common/admin-table-controls'
import { showErrorToast, showResultError } from '@/core/client/errors'
import {
  syncOaDepartmentsAction,
  syncOaProjectRolesAction,
  syncOaProjectsAction,
  syncOaUsersAction,
} from '@/modules/oa-sync/actions'
import type { OaSyncRunRow } from '@/modules/oa-sync/repo/sync-log.repo'
import type {
  OaProjectRoleSyncStats,
  OaProjectSyncStats,
  OaSyncScope,
  OaSyncStats,
  OaUserSyncStats,
} from '@/modules/oa-sync/types'

type Scope = OaSyncScope

type SyncResult =
  | { scope: 'departments'; data: OaSyncStats }
  | { scope: 'users'; data: OaUserSyncStats }
  | { scope: 'projects'; data: OaProjectSyncStats }
  | { scope: 'project_roles'; data: OaProjectRoleSyncStats }

const SCOPE_LABEL: Record<Scope, string> = {
  departments: '部门',
  users: '用户',
  projects: '项目',
  project_roles: '项目角色',
}

const STATUS_COLOR = {
  running: 'primary',
  succeeded: 'success',
  failed: 'danger',
} as const

const STATUS_LABEL = {
  running: '运行中',
  succeeded: '成功',
  failed: '失败',
} as const

function formatDate(value: Date | string | null): string {
  if (!value) return '-'
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('zh-CN')
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[92px]">
      <div className="text-default-500 text-xs">{label}</div>
      <div className="text-foreground mt-1 text-lg font-semibold">{value}</div>
    </div>
  )
}

function ResultSummary({ result }: { result: SyncResult }) {
  if (result.scope === 'departments') {
    const { data } = result
    return (
      <div className="border-divider bg-content1 rounded-lg border p-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Chip color="success" size="sm" variant="flat">
            同步完成
          </Chip>
          <span className="text-sm font-medium">部门数据</span>
          {data.missingParents.length > 0 ? (
            <Chip color="warning" size="sm" variant="flat">
              {data.missingParents.length} 条映射告警
            </Chip>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
          <StatItem label="拉取" value={data.pulledCount} />
          <StatItem label="新增" value={data.createdCount} />
          <StatItem label="更新" value={data.updatedCount} />
          <StatItem label="父级更新" value={data.parentUpdatedCount} />
          <StatItem label="未变化" value={data.unchangedCount} />
          <StatItem label="封存" value={data.deletedCount} />
        </div>

        {data.missingParents.length > 0 ? (
          <div className="text-warning mt-4 text-sm">
            未找到父部门：
            {data.missingParents
              .slice(0, 8)
              .map((item) => `${item.code} -> ${item.parentCode}`)
              .join('，')}
          </div>
        ) : null}
      </div>
    )
  }

  const data = result.data
  let warningCount = 0
  if (result.scope === 'users' || result.scope === 'projects') {
    warningCount = result.data.missingDepartments.length
  } else {
    warningCount = result.data.missingProjects.length + result.data.missingUsers.length
  }

  return (
    <div className="border-divider bg-content1 rounded-lg border p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Chip color="success" size="sm" variant="flat">
          同步完成
        </Chip>
        <span className="text-sm font-medium">{SCOPE_LABEL[result.scope]}数据</span>
        {warningCount > 0 ? (
          <Chip color="warning" size="sm" variant="flat">
            {warningCount} 条映射告警
          </Chip>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
        <StatItem label="拉取" value={data.pulledCount} />
        <StatItem label="新增" value={data.createdCount} />
        <StatItem label="更新" value={data.updatedCount} />
        <StatItem label="未变化" value={data.unchangedCount} />
        <StatItem
          label={result.scope === 'users' ? '离职' : '删除'}
          value={data.deletedCount}
        />
      </div>

      {result.scope === 'users' && result.data.missingDepartments.length > 0 ? (
        <div className="text-warning mt-4 text-sm">
          未找到部门：
          {result.data.missingDepartments
            .slice(0, 8)
            .map((item) => `${item.employeeNo} -> ${item.departmentCode}`)
            .join('，')}
        </div>
      ) : null}
      {result.scope === 'projects' && result.data.missingDepartments.length > 0 ? (
        <div className="text-warning mt-4 text-sm">
          未找到部门：
          {result.data.missingDepartments
            .slice(0, 8)
            .map((item) => `${item.projectNo} -> ${item.departmentCode}`)
            .join('，')}
        </div>
      ) : null}
      {result.scope === 'project_roles' && warningCount > 0 ? (
        <div className="text-warning mt-4 text-sm">
          映射缺失：
          {[
            ...result.data.missingProjects
              .slice(0, 4)
              .map((item) => `项目 ${item.projectNo}`),
            ...result.data.missingUsers
              .slice(0, 4)
              .map((item) => `用户 ${item.employeeNo}`),
          ].join('，')}
        </div>
      ) : null}
    </div>
  )
}

export default function OaSyncPanel({ recentRuns }: { recentRuns: OaSyncRunRow[] }) {
  const router = useRouter()
  const [pendingScope, setPendingScope] = useState<Scope | null>(null)
  const [isPending, startTransition] = useTransition()
  const [lastResult, setLastResult] = useState<SyncResult | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 20
  const totalPages = Math.ceil(recentRuns.length / pageSize)
  const pageRuns = useMemo(() => {
    const safePage = Math.min(page, Math.max(totalPages, 1))
    const start = (safePage - 1) * pageSize
    return recentRuns.slice(start, start + pageSize)
  }, [page, recentRuns, totalPages])

  const runSync = (scope: Scope) => {
    setPendingScope(scope)
    startTransition(async () => {
      try {
        const result = await (scope === 'departments'
          ? syncOaDepartmentsAction()
          : scope === 'users'
            ? syncOaUsersAction()
            : scope === 'projects'
              ? syncOaProjectsAction()
              : syncOaProjectRolesAction())

        if (!result.success) {
          showResultError(result, 'OA 同步失败')
          return
        }

        if (scope === 'departments') {
          setLastResult({ scope, data: result.data as OaSyncStats })
        } else if (scope === 'users') {
          setLastResult({ scope, data: result.data as OaUserSyncStats })
        } else if (scope === 'projects') {
          setLastResult({ scope, data: result.data as OaProjectSyncStats })
        } else {
          setLastResult({ scope, data: result.data as OaProjectRoleSyncStats })
        }
        router.refresh()
      } catch (error) {
        showErrorToast({ title: 'OA 同步失败', error })
      } finally {
        setPendingScope(null)
      }
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        <Button
          color="primary"
          startContent={
            pendingScope !== 'departments' ? (
              <Icon icon="lucide:building-2" className="size-4" aria-hidden />
            ) : null
          }
          isLoading={isPending && pendingScope === 'departments'}
          isDisabled={isPending}
          onPress={() => runSync('departments')}
        >
          同步部门
        </Button>
        <Button
          color="primary"
          variant="flat"
          startContent={
            pendingScope !== 'users' ? (
              <Icon icon="lucide:users" className="size-4" aria-hidden />
            ) : null
          }
          isLoading={isPending && pendingScope === 'users'}
          isDisabled={isPending}
          onPress={() => runSync('users')}
        >
          同步用户
        </Button>
        <Button
          color="primary"
          variant="flat"
          startContent={
            pendingScope !== 'projects' ? (
              <Icon icon="lucide:briefcase-business" className="size-4" aria-hidden />
            ) : null
          }
          isLoading={isPending && pendingScope === 'projects'}
          isDisabled={isPending}
          onPress={() => runSync('projects')}
        >
          同步项目
        </Button>
        <Button
          color="primary"
          variant="flat"
          startContent={
            pendingScope !== 'project_roles' ? (
              <Icon icon="lucide:users-round" className="size-4" aria-hidden />
            ) : null
          }
          isLoading={isPending && pendingScope === 'project_roles'}
          isDisabled={isPending}
          onPress={() => runSync('project_roles')}
        >
          同步项目角色
        </Button>
      </div>

      {lastResult ? <ResultSummary result={lastResult} /> : null}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">最近同步记录</h2>
        <Table
          aria-label="OA 同步日志"
          classNames={{ wrapper: 'overflow-x-auto' }}
          bottomContent={
            <AdminTablePagination page={page} totalPages={totalPages} onChange={setPage} />
          }
        >
          <TableHeader>
            <TableColumn>时间</TableColumn>
            <TableColumn>范围</TableColumn>
            <TableColumn>触发</TableColumn>
            <TableColumn>状态</TableColumn>
            <TableColumn>拉取</TableColumn>
            <TableColumn>新增/更新</TableColumn>
            <TableColumn>告警</TableColumn>
            <TableColumn>错误</TableColumn>
          </TableHeader>
          <TableBody
            items={pageRuns}
            emptyContent={<div className="text-default-400 py-8">暂无同步记录</div>}
          >
            {(run) => (
              <TableRow key={run.id}>
                <TableCell>{formatDate(run.startedAt)}</TableCell>
                <TableCell>{SCOPE_LABEL[run.scope]}</TableCell>
                <TableCell>{run.trigger}</TableCell>
                <TableCell>
                  <Chip color={STATUS_COLOR[run.status]} size="sm" variant="flat">
                    {STATUS_LABEL[run.status]}
                  </Chip>
                </TableCell>
                <TableCell>{run.pulledCount}</TableCell>
                <TableCell>
                  {run.createdCount}/{run.updatedCount}
                </TableCell>
                <TableCell>{run.warningCount}</TableCell>
                <TableCell className="max-w-[240px] truncate">
                  {run.errorMessage ?? '-'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <AdminTableSummary total={recentRuns.length} page={page} totalPages={totalPages} />
      </div>
    </div>
  )
}
