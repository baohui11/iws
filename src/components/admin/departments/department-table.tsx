'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
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
  addToast,
} from '@heroui/react'
import { Icon } from '@iconify/react'
import Link from 'next/link'
import { listDepartments, removeDepartment } from '@/actions/admin/departments.action'
import type { DepartmentWithRelations } from '@/lib/db/admin/departments'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmModal from '@/components/common/confirm-modal'

interface DepartmentTableProps {
  initialDepartments: DepartmentWithRelations[]
  initialTotal: number
}

export default function DepartmentTable({
  initialDepartments,
  initialTotal,
}: DepartmentTableProps) {
  const [rows, setRows] = useState(initialDepartments)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [keyword, setKeyword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { confirm, modalProps } = useConfirm()

  const fetchPage = useCallback(
    async (p: number, kw: string) => {
      setIsLoading(true)
      const result = await listDepartments({
        page: p,
        pageSize,
        keyword: kw.trim() || undefined,
      })
      setIsLoading(false)
      if (result.success && result.data) {
        setRows(result.data.departments)
        setTotal(result.data.total)
      } else {
        addToast({
          title: '加载失败',
          description: result.message ?? '获取部门列表失败',
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
    void fetchPage(page, keyword)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅翻页时拉取；关键词通过「搜索」按钮触发 fetchPage(1, keyword)
  }, [page, pageSize, fetchPage])

  const handleSearch = () => {
    setPage(1)
    void fetchPage(1, keyword)
  }

  const openDeleteConfirm = (id: string, name: string) => {
    confirm({
      title: '删除部门',
      description: `确定删除部门「${name}」吗？删除后不可恢复。`,
      onConfirm: async () => {
        setDeletingId(id)
        try {
          const result = await removeDepartment(id)
          if (result.success) {
            addToast({ title: '已删除', color: 'success', timeout: 2000 })
            void fetchPage(page, keyword)
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
      <div className="flex flex-wrap items-center gap-4">
        <Input
          placeholder="搜索名称或编码..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          startContent={<Icon icon="lucide:search" className="size-4 text-default-400" aria-hidden />}
          className="w-64"
          size="sm"
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
          href="/admin/departments/new"
          color="primary"
          size="sm"
          startContent={<Icon icon="lucide:plus" className="size-4" aria-hidden />}
        >
          添加部门
        </Button>
      </div>

      <Table
        aria-label="部门列表"
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
          <TableColumn>编码</TableColumn>
          <TableColumn>名称</TableColumn>
          <TableColumn>上级</TableColumn>
          <TableColumn>部门 LD（角色）</TableColumn>
          <TableColumn>层级</TableColumn>
          <TableColumn>操作</TableColumn>
        </TableHeader>
        <TableBody
          items={rows}
          emptyContent={<div className="py-8 text-default-400">暂无部门数据</div>}
          isLoading={isLoading}
          loadingContent={<div className="py-8">加载中...</div>}
        >
          {(row) => (
            <TableRow key={row.id}>
              <TableCell>{row.code}</TableCell>
              <TableCell>{row.name}</TableCell>
              <TableCell>{row.parent_name ?? '—'}</TableCell>
              <TableCell>{row.leader_name ?? '—'}</TableCell>
              <TableCell>{row.level ?? '—'}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button
                    as={Link}
                    href={`/admin/departments/${row.id}`}
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
                    isDisabled={deletingId === row.id}
                    onPress={() => openDeleteConfirm(row.id, row.name)}
                  >
                    <Icon icon="lucide:trash-2" className="size-[18px]" aria-hidden />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="text-sm text-default-400">
        共 {total} 条
        {totalPages > 1 && `，第 ${page} / ${totalPages} 页`}
      </div>

      <ConfirmModal
        {...modalProps}
        confirmText="删除"
        isLoading={deletingId !== null}
      />
    </div>
  )
}
