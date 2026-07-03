'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { showResultError } from '@/core/client/errors'
import {
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  Button,
  Chip,
  Input,
  Select,
  SelectItem,
} from '@heroui/react'
import { Icon } from '@iconify/react'
import Link from 'next/link'
import { exportUsersCsv, listUsers } from '@/modules/org/users/actions'
import type { UserWithDepartment } from '@/modules/org/users/repo'
import type { DepartmentNode } from '@/modules/org/departments/repo'
import {
  defaultSystemRole,
  SYSTEM_ROLE_LABEL,
  SYSTEM_ROLE_OPTIONS,
  type SystemRoleValue,
} from '@/constants/system-roles'
import DepartmentTreeSelect from '@/modules/org/components/department-tree-select'
import {
  flattenDepartmentTree,
  formatDepartmentPathLabel,
} from '@/modules/org/departments/display'
import {
  AdminTablePagination,
  AdminTableSummary,
  AdminTableToolbar,
} from '@/components/common/admin-table-controls'

interface UserTableProps {
  initialUsers: UserWithDepartment[]
  initialTotal: number
  departments: DepartmentNode[]
}

export default function UserTable({
  initialUsers,
  initialTotal,
  departments,
}: UserTableProps) {
  const [users, setUsers] = useState<UserWithDepartment[]>(initialUsers)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [keyword, setKeyword] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [role, setRole] = useState('')
  const [tags, setTags] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const flatDepartments = useMemo(
    () => flattenDepartmentTree(departments),
    [departments]
  )

  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    const result = await listUsers({
      page,
      pageSize,
      keyword: keyword || undefined,
      department_id: departmentId || undefined,
      role: role ? (role as SystemRoleValue) : undefined,
      tags: tags || undefined,
    })
    setIsLoading(false)
    if (result.success && result.data) {
      setUsers(result.data.users)
      setTotal(result.data.total)
    } else {
      showResultError(result, '加载失败')
    }
  }, [page, pageSize, keyword, departmentId, role, tags])

  const skipFirstSyncRef = useRef(true)
  useEffect(() => {
    if (skipFirstSyncRef.current) {
      skipFirstSyncRef.current = false
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUsers()
  }, [page, pageSize, departmentId, role, loadUsers])

  const handleSearch = () => {
    setPage(1)
    loadUsers()
  }

  const downloadCsv = async () => {
    setIsExporting(true)
    const result = await exportUsersCsv({
      keyword: keyword || undefined,
      department_id: departmentId || undefined,
      role: role ? (role as SystemRoleValue) : undefined,
      tags: tags || undefined,
    })
    setIsExporting(false)
    if (!result.success) {
      showResultError(result, '导出失败')
      return
    }
    const blob = new Blob([result.data.csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = result.data.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-4">
      <AdminTableToolbar
        keyword={keyword}
        onKeywordChange={setKeyword}
        onSearch={handleSearch}
        searchPlaceholder="搜索姓名或工号..."
        isLoading={isLoading}
        filters={
          <>
            <DepartmentTreeSelect
              departments={departments}
              value={departmentId}
              onChange={(id) => {
                setDepartmentId(id)
                setPage(1)
              }}
              placeholder="全部部门"
              emptyOptionLabel="全部部门"
              includeInactive
              size="sm"
              variant="bordered"
              className="w-[260px]"
            />
            <Select
              aria-label="角色筛选"
              placeholder="全部角色"
              selectedKeys={role ? new Set([role]) : new Set(['__all__'])}
              onSelectionChange={(keys) => {
                if (keys === 'all') return
                const next = String(Array.from(keys)[0] ?? '')
                setRole(next === '__all__' ? '' : next)
                setPage(1)
              }}
              size="sm"
              variant="bordered"
              className="w-[150px]"
            >
              {[{ key: '__all__', label: '全部角色' }, ...SYSTEM_ROLE_OPTIONS].map((option) => (
                <SelectItem key={option.key}>{option.label}</SelectItem>
              ))}
            </Select>
            <Input
              aria-label="标签筛选"
              placeholder="标签"
              value={tags}
              onValueChange={setTags}
              onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
              size="sm"
              variant="bordered"
              className="w-[160px]"
            />
          </>
        }
        actions={
          <Button
            size="sm"
            variant="flat"
            color="primary"
            isLoading={isExporting}
            startContent={
              !isExporting && <Icon icon="lucide:download" className="size-4" aria-hidden />
            }
            onPress={() => void downloadCsv()}
          >
            导出 CSV
          </Button>
        }
      />

      <Table
        aria-label="用户列表"
        classNames={{ wrapper: 'overflow-x-auto' }}
        bottomContent={
          <AdminTablePagination page={page} totalPages={totalPages} onChange={setPage} />
        }
      >
        <TableHeader>
          <TableColumn>工号</TableColumn>
          <TableColumn>姓名</TableColumn>
          <TableColumn>部门</TableColumn>
          <TableColumn>角色</TableColumn>
          <TableColumn>标签</TableColumn>
          <TableColumn>生效状态</TableColumn>
          <TableColumn align="end">操作</TableColumn>
        </TableHeader>
        <TableBody
          items={users}
          emptyContent={<div className="text-default-400 py-8">暂无用户数据</div>}
          isLoading={isLoading}
          loadingContent={<div className="py-8">加载中...</div>}
        >
          {(user) => (
            <TableRow key={user.id}>
              <TableCell>{user.employee_no}</TableCell>
              <TableCell>{user.name}</TableCell>
              <TableCell>
                {formatDepartmentPathLabel(
                  user.department_id,
                  flatDepartments,
                  user.department_name
                )}
              </TableCell>
              <TableCell>
                <Chip size="sm" variant="flat" color="primary">
                  {SYSTEM_ROLE_LABEL[defaultSystemRole(user.role)]}
                </Chip>
              </TableCell>
              <TableCell>{user.tags?.trim() || '-'}</TableCell>
              <TableCell>
                <Chip size="sm" color={user.is_active ? 'success' : 'default'} variant="flat">
                  {user.is_active ? '已生效' : '未生效'}
                </Chip>
              </TableCell>
              <TableCell>
                <div className="flex justify-end">
                  <Button
                    as={Link}
                    href={`/admin/users/${user.id}`}
                    size="sm"
                    variant="light"
                    isIconOnly
                    aria-label="查看用户详情"
                  >
                    <Icon icon="lucide:eye" className="text-default-600 size-[18px]" aria-hidden />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <AdminTableSummary total={total} page={page} totalPages={totalPages} />
    </div>
  )
}
