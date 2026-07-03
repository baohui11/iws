'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react'
import { Icon } from '@iconify/react'
import {
  AdminTablePagination,
  AdminTableSummary,
  AdminTableToolbar,
} from '@/components/common/admin-table-controls'
import type { UserDataScopeRow } from '@/modules/org/users/repo'

interface DataScopesListProps {
  scopes: UserDataScopeRow[]
}

interface ScopeGroup {
  user_id: string
  user_name: string | null
  employee_no: string | null
  user_department_name: string | null
  ranges: string[]
  has_all: boolean
}

function groupScopes(scopes: UserDataScopeRow[]): ScopeGroup[] {
  const byUser = new Map<string, ScopeGroup>()
  for (const scope of scopes) {
    if (!scope.user_id) continue
    const group =
      byUser.get(scope.user_id) ??
      ({
        user_id: scope.user_id,
        user_name: scope.user_name ?? null,
        employee_no: scope.employee_no ?? null,
        user_department_name: scope.user_department_name ?? null,
        ranges: [],
        has_all: false,
      } satisfies ScopeGroup)
    if (scope.scope_type === 'all') {
      group.has_all = true
    } else if (scope.department_name) {
      group.ranges.push(scope.department_name)
    }
    byUser.set(scope.user_id, group)
  }
  return [...byUser.values()]
}

export default function DataScopesList({ scopes }: DataScopesListProps) {
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20
  const groups = useMemo(() => groupScopes(scopes), [scopes])
  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    if (!q) return groups
    return groups.filter((group) =>
      [
        group.user_name,
        group.employee_no,
        group.user_department_name,
        group.has_all ? '全公司' : null,
        ...group.ranges,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    )
  }, [groups, keyword])
  const totalPages = Math.ceil(filtered.length / pageSize)
  const pageRows = useMemo(() => {
    const safePage = Math.min(page, Math.max(totalPages, 1))
    const start = (safePage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, totalPages])

  const handleSearch = () => setPage(1)

  return (
    <div className="space-y-4">
      <AdminTableToolbar
        keyword={keyword}
        onKeywordChange={(value) => {
          setKeyword(value)
          setPage(1)
        }}
        onSearch={handleSearch}
        searchPlaceholder="搜索用户、工号、部门"
        actions={
          <Button
            as={Link}
            href="/admin/data-scopes/new"
            color="primary"
            size="sm"
            startContent={<Icon icon="lucide:plus" className="size-4" aria-hidden />}
          >
            新增授权
          </Button>
        }
      />

      <Table
        aria-label="数据权限列表"
        classNames={{ wrapper: 'overflow-x-auto' }}
        bottomContent={
          <AdminTablePagination page={page} totalPages={totalPages} onChange={setPage} />
        }
      >
        <TableHeader>
          <TableColumn>用户</TableColumn>
          <TableColumn>所属部门</TableColumn>
          <TableColumn>额外数据范围</TableColumn>
          <TableColumn align="end">操作</TableColumn>
        </TableHeader>
        <TableBody
          items={pageRows}
          emptyContent={<div className="text-default-400 py-8">暂无数据权限</div>}
        >
          {(group) => (
            <TableRow key={group.user_id}>
              <TableCell>
                <div className="flex flex-col">
                  <span>{group.user_name ?? '-'}</span>
                  <span className="text-default-400 text-xs">
                    {group.employee_no ?? '-'}
                  </span>
                </div>
              </TableCell>
              <TableCell>{group.user_department_name ?? '-'}</TableCell>
              <TableCell>
                {group.has_all
                  ? '全公司'
                  : group.ranges.length
                    ? group.ranges.join('、')
                    : '-'}
              </TableCell>
              <TableCell>
                <div className="flex justify-end">
                  <Button
                    as={Link}
                    href={`/admin/data-scopes/${group.user_id}`}
                    size="sm"
                    variant="light"
                    isIconOnly
                    aria-label="编辑数据权限"
                  >
                    <Icon icon="lucide:square-pen" className="size-4" aria-hidden />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <AdminTableSummary total={filtered.length} page={page} totalPages={totalPages} />
    </div>
  )
}
