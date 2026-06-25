'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  Input,
  Button,
  Pagination,
  Chip,
  addToast,
} from '@heroui/react'
import { Icon } from '@iconify/react'
import Link from 'next/link'
import { listUsers, removeUser } from '@/modules/org/users/actions'
import type { UserWithDepartment } from '@/modules/org/users/repo'
import type { DepartmentNode } from '@/modules/org/departments/repo'
import DepartmentTreeSelect from '@/modules/org/components/department-tree-select'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmModal from '@/components/common/confirm-modal'
import {
  flattenDepartmentTree,
  formatDepartmentPathLabel,
} from '@/modules/org/departments/display'

interface UserTableProps {
  initialUsers: UserWithDepartment[]
  initialTotal: number
  departments: DepartmentNode[]
}

const GENDER_COLOR_MAP: Record<string, 'primary' | 'danger' | 'default'> = {
  男: 'primary',
  女: 'danger',
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
  const [isLoading, setIsLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { confirm, modalProps } = useConfirm()

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
    })
    setIsLoading(false)
    if (result.success && result.data) {
      setUsers(result.data.users)
      setTotal(result.data.total)
    } else {
      addToast({
        title: '加载失败',
        description: result.success ? undefined : result.message,
        color: 'danger',
      })
    }
  }, [page, pageSize, keyword, departmentId])

  const skipFirstSyncRef = useRef(true)
  useEffect(() => {
    if (skipFirstSyncRef.current) {
      skipFirstSyncRef.current = false
      return
    }
    loadUsers()
  }, [page, pageSize, departmentId, loadUsers])

  const handleSearch = () => {
    setPage(1)
    loadUsers()
  }

  const openDeleteConfirm = (id: string, name: string) => {
    confirm({
      title: '删除用户',
      description: `确定删除用户「${name}」吗？删除后不可恢复。`,
      onConfirm: async () => {
        setDeletingId(id)
        try {
          const result = await removeUser(id)
          if (result.success) {
            addToast({
              title: '删除成功',
              description: `用户「${name}」已删除`,
              color: 'success',
              timeout: 2000,
            })
            loadUsers()
          } else {
            addToast({
              title: '删除失败',
              description: result.message,
              color: 'danger',
            })
          }
        } finally {
          setDeletingId(null)
        }
      },
    })
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Input
          placeholder="搜索姓名或工号..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          startContent={
            <Icon icon="lucide:search" className="text-default-400 size-4" aria-hidden />
          }
          className="w-64"
          size="sm"
        />

        <DepartmentTreeSelect
          departments={departments}
          value={departmentId}
          onChange={(id) => {
            setDepartmentId(id)
            setPage(1)
          }}
          placeholder="全部部门"
          emptyOptionLabel="全部部门"
          size="sm"
          variant="bordered"
          className="max-w-xs min-w-[220px]"
        />

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

        <div className="flex-1" />

        <Button
          as={Link}
          href="/admin/users/new"
          color="primary"
          size="sm"
          startContent={<Icon icon="lucide:user-plus" className="size-4" aria-hidden />}
        >
          添加用户
        </Button>

        <Button
          as={Link}
          href="/admin/users/import"
          color="secondary"
          variant="flat"
          size="sm"
          startContent={<Icon icon="lucide:file-up" className="size-4" aria-hidden />}
        >
          批量导入
        </Button>
      </div>

      <Table
        aria-label="用户列表"
        bottomContent={
          totalPages > 1 && (
            <div className="flex justify-center">
              <Pagination
                page={page}
                total={totalPages}
                onChange={setPage}
                showControls
                size="sm"
              />
            </div>
          )
        }
      >
        <TableHeader>
          <TableColumn>姓名</TableColumn>
          <TableColumn>工号</TableColumn>
          <TableColumn>性别</TableColumn>
          <TableColumn>部门</TableColumn>
          <TableColumn>职位</TableColumn>
          <TableColumn>邮箱</TableColumn>
          <TableColumn>操作</TableColumn>
        </TableHeader>
        <TableBody
          items={users}
          emptyContent={<div className="text-default-400 py-8">暂无用户数据</div>}
          isLoading={isLoading}
          loadingContent={<div className="py-8">加载中...</div>}
        >
          {(user) => (
            <TableRow key={user.id}>
              <TableCell>{user.name}</TableCell>
              <TableCell>{user.employee_no}</TableCell>
              <TableCell>
                <Chip
                  size="sm"
                  color={GENDER_COLOR_MAP[user.gender ?? ''] || 'default'}
                  variant="flat"
                >
                  {user.gender}
                </Chip>
              </TableCell>
              <TableCell>
                {formatDepartmentPathLabel(
                  user.department_id,
                  flatDepartments,
                  user.department_name
                )}
              </TableCell>
              <TableCell>{user.position ?? '-'}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    as={Link}
                    href={`/admin/users/${user.id}`}
                    size="sm"
                    variant="light"
                    isIconOnly
                  >
                    <Icon
                      icon="lucide:square-pen"
                      className="text-default-600 size-[18px]"
                      aria-hidden
                    />
                  </Button>
                  <Button
                    size="sm"
                    variant="light"
                    color="danger"
                    isIconOnly
                    isDisabled={deletingId === user.id}
                    onPress={() => openDeleteConfirm(user.id, user.name ?? '')}
                  >
                    <Icon icon="lucide:trash-2" className="size-[18px]" aria-hidden />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="text-default-400 text-sm">
        共 {total} 条记录{totalPages > 1 && `，第 ${page} / ${totalPages} 页`}
      </div>

      <ConfirmModal {...modalProps} confirmText="删除" isLoading={deletingId !== null} />
    </div>
  )
}
