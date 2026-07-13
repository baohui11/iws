'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { showErrorToast, showResultError } from '@/core/client/errors'
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
  addToast,
  type Selection,
} from '@heroui/react'
import { Icon } from '@iconify/react'
import Link from 'next/link'
import {
  activateUsers,
  exportUsersCsv,
  listUsers,
  sendUserInvites,
} from '@/modules/org/users/actions'
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
  const [isSendingInvites, setIsSendingInvites] = useState(false)
  const [isActivating, setIsActivating] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Selection>(new Set([]))
  const listRequestSeqRef = useRef(0)

  const flatDepartments = useMemo(
    () => flattenDepartmentTree(departments),
    [departments]
  )

  const loadUsers = useCallback(async () => {
    const seq = ++listRequestSeqRef.current
    setIsLoading(true)
    try {
      const result = await listUsers({
        page,
        pageSize,
        keyword: keyword || undefined,
        department_id: departmentId || undefined,
        role: role ? (role as SystemRoleValue) : undefined,
        tags: tags || undefined,
      })
      if (seq !== listRequestSeqRef.current) return
      if (result.success && result.data) {
        setUsers(result.data.users)
        setTotal(result.data.total)
      } else {
        showResultError(result, '加载失败')
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
  }, [page, pageSize, keyword, departmentId, role, tags])

  const skipFirstSyncRef = useRef(true)
  useEffect(() => {
    if (skipFirstSyncRef.current) {
      skipFirstSyncRef.current = false
      return
    }
    void loadUsers()
  }, [page, pageSize, departmentId, role, loadUsers])

  const handleSearch = () => {
    setPage(1)
    loadUsers()
  }

  const selectedIds = useMemo(() => {
    if (selectedKeys === 'all') return users.map((user) => user.id)
    return Array.from(selectedKeys).map(String)
  }, [selectedKeys, users])

  const selectedInviteEligibleIds = useMemo(() => {
    const selected = new Set(selectedIds)
    return users
      .filter(
        (user) =>
          selected.has(user.id) &&
          user.is_active &&
          !user.invite_sent_at &&
          !!user.email?.trim()
      )
      .map((user) => user.id)
  }, [selectedIds, users])

  const selectedInactiveIds = useMemo(() => {
    const selected = new Set(selectedIds)
    return users
      .filter((user) => selected.has(user.id) && !user.is_active)
      .map((user) => user.id)
  }, [selectedIds, users])

  const downloadCsv = async () => {
    setIsExporting(true)
    try {
      const result = await exportUsersCsv({
        keyword: keyword || undefined,
        department_id: departmentId || undefined,
        role: role ? (role as SystemRoleValue) : undefined,
        tags: tags || undefined,
      })
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
    } catch (error) {
      showErrorToast({ title: '导出失败', error })
    } finally {
      setIsExporting(false)
    }
  }

  const sendSelectedInvites = async () => {
    if (selectedInviteEligibleIds.length === 0) {
      addToast({
        title: '没有可发送邀请的用户',
        description: '请选择已生效、未发送过邀请且有邮箱的用户',
        color: 'warning',
        timeout: 2500,
      })
      return
    }

    setIsSendingInvites(true)
    try {
      const result = await sendUserInvites({ ids: selectedInviteEligibleIds })
      if (!result.success) {
        showResultError(result, '发送失败')
        return
      }
      const data = result.data
      addToast({
        title: `邀请邮件已发送 ${data.sent_count} 人`,
        description:
          data.failed_count > 0
            ? `跳过 ${data.skipped_count} 人，失败 ${data.failed_count} 人`
            : `跳过 ${data.skipped_count} 人`,
        color: data.failed_count > 0 ? 'warning' : 'success',
        timeout: 3000,
      })
      setSelectedKeys(new Set([]))
      await loadUsers()
    } catch (error) {
      showErrorToast({ title: '发送失败', error })
    } finally {
      setIsSendingInvites(false)
    }
  }

  const activateSelectedUsers = async () => {
    if (selectedInactiveIds.length === 0) {
      addToast({
        title: '没有可生效的用户',
        description: '请选择未生效用户',
        color: 'warning',
        timeout: 2500,
      })
      return
    }

    setIsActivating(true)
    try {
      const result = await activateUsers({ ids: selectedInactiveIds })
      if (!result.success) {
        showResultError(result, '批量生效失败')
        return
      }
      addToast({
        title: `已生效 ${result.data.updated_count} 人`,
        description: `跳过 ${result.data.skipped_count} 人`,
        color: 'success',
        timeout: 2500,
      })
      setSelectedKeys(new Set([]))
      await loadUsers()
    } catch (error) {
      showErrorToast({ title: '批量生效失败', error })
    } finally {
      setIsActivating(false)
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-4">
      <AdminTableToolbar
        keyword={keyword}
        onKeywordChange={(value) => {
          setKeyword(value)
          setPage(1)
        }}
        onSearch={handleSearch}
        searchPlaceholder="搜索姓名或工号..."
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
              onValueChange={(value) => {
                setTags(value)
                setPage(1)
              }}
              onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
              size="sm"
              variant="bordered"
              className="w-[160px]"
            />
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="flat"
              color="primary"
              isLoading={isActivating}
              isDisabled={selectedIds.length === 0}
              startContent={
                !isActivating && <Icon icon="lucide:circle-check" className="size-4" aria-hidden />
              }
              onPress={() => void activateSelectedUsers()}
            >
              批量生效{selectedInactiveIds.length > 0 ? ` (${selectedInactiveIds.length})` : ''}
            </Button>
            <Button
              size="sm"
              variant="flat"
              color="primary"
              isLoading={isSendingInvites}
              isDisabled={selectedIds.length === 0}
              startContent={
                !isSendingInvites && <Icon icon="lucide:mail-plus" className="size-4" aria-hidden />
              }
              onPress={() => void sendSelectedInvites()}
            >
              发送邀请{selectedInviteEligibleIds.length > 0 ? ` (${selectedInviteEligibleIds.length})` : ''}
            </Button>
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
          </div>
        }
      />

      <Table
        aria-label="用户列表"
        classNames={{ wrapper: 'overflow-x-auto' }}
        selectionMode="multiple"
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
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
          <TableColumn>邀请邮件</TableColumn>
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
                <Chip size="sm" color={user.invite_sent_at ? 'success' : 'default'} variant="flat">
                  {user.invite_sent_at ? '已发送' : '未发送'}
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
                    aria-label="编辑用户"
                  >
                    <Icon icon="lucide:pencil" className="text-default-600 size-[18px]" aria-hidden />
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
