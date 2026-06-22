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
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from '@heroui/react'
import { Icon } from '@iconify/react'
import Link from 'next/link'
import { listProjects, removeProject } from '@/actions/admin/projects.action'
import type { ProjectListItem } from '@/lib/db/admin/projects'
import type { DepartmentNode } from '@/lib/db/admin/departments'
import DepartmentTreeSelect from '@/components/admin/department-tree-select'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmModal from '@/components/common/confirm-modal'
import {
  flattenDepartmentTree,
  formatDepartmentPathLabel,
} from '@/lib/utils/department-display'

const STATUS_LABEL: Record<string, string> = {
  active: '进行中',
  preparing: '筹备',
  completed: '已完成',
  archived: '已归档',
  suspended: '已暂停',
}

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'primary' | 'default' | 'danger'> = {
  active: 'success',
  preparing: 'warning',
  completed: 'primary',
  archived: 'default',
  suspended: 'danger',
}

interface ProjectTableProps {
  initialProjects: ProjectListItem[]
  initialTotal: number
  departments: DepartmentNode[]
}

export default function ProjectTable({
  initialProjects,
  initialTotal,
  departments,
}: ProjectTableProps) {
  const [rows, setRows] = useState(initialProjects)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [keyword, setKeyword] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { confirm, modalProps } = useConfirm()

  const flatDepartments = useMemo(() => flattenDepartmentTree(departments), [departments])

  const fetchPage = useCallback(
    async (p: number, kw: string, dept: string) => {
      setIsLoading(true)
      const result = await listProjects({
        page: p,
        pageSize,
        keyword: kw.trim() || undefined,
        department_id: dept.trim() || undefined,
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
    [pageSize]
  )

  const skipFirst = useRef(true)
  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false
      return
    }
    void fetchPage(page, keyword, departmentId)
  }, [page, pageSize, fetchPage, departmentId])

  const handleSearch = () => {
    setPage(1)
    void fetchPage(1, keyword, departmentId)
  }

  const openDeleteConfirm = (id: string, name: string) => {
    confirm({
      title: '删除项目',
      description: `确定删除项目「${name}」吗？将同时移除成员与成果清单关联，且不可恢复。`,
      onConfirm: async () => {
        setDeletingId(id)
        try {
          const result = await removeProject(id)
          if (result.success) {
            addToast({ title: '已删除', color: 'success', timeout: 2000 })
            void fetchPage(page, keyword, departmentId)
          } else {
            addToast({ title: '删除失败', description: result.message, color: 'danger' })
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
      <ConfirmModal {...modalProps} />

      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-4">
        <Input
          placeholder="编号、名称、客户、合同号"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          startContent={
            <Icon icon="lucide:search" className="size-4 text-default-400" aria-hidden />
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
          className="min-w-[220px] max-w-xs"
        />

        <Button
          color="primary"
          size="sm"
          onPress={handleSearch}
          isLoading={isLoading}
          startContent={!isLoading && <Icon icon="lucide:search" className="size-4" aria-hidden />}
        >
          搜索
        </Button>

        <div className="flex-1" />

        <Button
          as={Link}
          href="/admin/projects/new"
          color="primary"
          size="sm"
          startContent={<Icon icon="lucide:folder-plus" className="size-4" aria-hidden />}
        >
          新建项目
        </Button>

        <Dropdown>
          <DropdownTrigger>
            <Button
              color="secondary"
              variant="flat"
              size="sm"
              startContent={<Icon icon="lucide:file-up" className="size-4" aria-hidden />}
            >
              批量导入
            </Button>
          </DropdownTrigger>
          <DropdownMenu aria-label="批量导入">
            <DropdownItem key="main" as={Link} href="/admin/projects/import">
              项目主表
            </DropdownItem>
            <DropdownItem key="members" as={Link} href="/admin/projects/import/members">
              项目成员
            </DropdownItem>
            <DropdownItem key="deliverables" as={Link} href="/admin/projects/import/deliverables">
              成果清单
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>

      <Table
        aria-label="项目列表"
        classNames={{ wrapper: 'overflow-x-auto' }}
      >
        <TableHeader>
          <TableColumn>项目编号</TableColumn>
          <TableColumn>项目名称</TableColumn>
          <TableColumn>部门</TableColumn>
          <TableColumn>状态</TableColumn>
          <TableColumn align="end">操作</TableColumn>
        </TableHeader>
        <TableBody emptyContent={isLoading ? '加载中…' : '暂无数据'}>
          {rows.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <span className="font-mono text-sm">{p.project_no ?? '—'}</span>
              </TableCell>
              <TableCell>{p.project_name ?? '—'}</TableCell>
              <TableCell className="max-w-[240px] truncate">
                {formatDepartmentPathLabel(
                  p.department_id,
                  flatDepartments,
                  p.department_name
                )}
              </TableCell>
              <TableCell>
                {p.project_status ? (
                  <Chip
                    size="sm"
                    variant="flat"
                    color={STATUS_COLOR[p.project_status] ?? 'default'}
                  >
                    {STATUS_LABEL[p.project_status] ?? p.project_status}
                  </Chip>
                ) : (
                  '—'
                )}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button
                    as={Link}
                    href={`/admin/projects/${p.id}`}
                    size="sm"
                    variant="light"
                    isIconOnly
                  >
                    <Icon icon="lucide:square-pen" className="size-[18px] text-default-600" aria-hidden />
                  </Button>
                  <Button
                    size="sm"
                    variant="light"
                    color="danger"
                    isIconOnly
                    isLoading={deletingId === p.id}
                    onPress={() =>
                      openDeleteConfirm(p.id, p.project_name ?? p.project_no ?? '')
                    }
                  >
                    <Icon icon="lucide:trash-2" className="size-[18px]" aria-hidden />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination
            total={totalPages}
            page={page}
            onChange={setPage}
            showControls
            size="sm"
          />
        </div>
      )}
    </div>
  )
}
