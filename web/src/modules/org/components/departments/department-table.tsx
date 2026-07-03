'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { showResultError } from '@/core/client/errors'
import {
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  Switch,
  addToast,
} from '@heroui/react'
import {
  listDepartments,
  updateDepartmentActive,
} from '@/modules/org/departments/actions'
import type { DepartmentWithRelations } from '@/modules/org/departments/repo'
import {
  AdminTablePagination,
  AdminTableSummary,
  AdminTableToolbar,
} from '@/components/common/admin-table-controls'

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
  const [savingActiveId, setSavingActiveId] = useState<string | null>(null)

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
        showResultError(result, '加载失败')
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, fetchPage])

  const handleSearch = () => {
    setPage(1)
    void fetchPage(1, keyword)
  }

  const setDepartmentActive = async (
    row: DepartmentWithRelations,
    isActive: boolean
  ) => {
    const previous = row.is_active
    setSavingActiveId(row.id)
    setRows((current) =>
      current.map((item) =>
        item.id === row.id ? { ...item, is_active: isActive } : item
      )
    )
    try {
      const result = await updateDepartmentActive({
        id: row.id,
        is_active: isActive,
      })
      if (!result.success) {
        setRows((current) =>
          current.map((item) =>
            item.id === row.id ? { ...item, is_active: previous } : item
          )
        )
        showResultError(result, '保存失败')
        return
      }
      addToast({
        title: isActive ? '部门已激活' : '部门已停用',
        color: 'success',
        timeout: 1600,
      })
    } finally {
      setSavingActiveId(null)
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-4">
      <AdminTableToolbar
        keyword={keyword}
        onKeywordChange={setKeyword}
        onSearch={handleSearch}
        searchPlaceholder="搜索名称或编码..."
        isLoading={isLoading}
      />

      <Table
        aria-label="部门列表"
        classNames={{ wrapper: 'overflow-x-auto' }}
        bottomContent={
          <AdminTablePagination page={page} totalPages={totalPages} onChange={setPage} />
        }
      >
        <TableHeader>
          <TableColumn>编码</TableColumn>
          <TableColumn>名称</TableColumn>
          <TableColumn>上级</TableColumn>
          <TableColumn>部门 LD（OA）</TableColumn>
          <TableColumn>层级</TableColumn>
          <TableColumn>激活状态</TableColumn>
        </TableHeader>
        <TableBody
          items={rows}
          emptyContent={<div className="text-default-400 py-8">暂无部门数据</div>}
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
                <Switch
                  size="sm"
                  isSelected={row.is_active}
                  isDisabled={savingActiveId === row.id}
                  onValueChange={(value) => void setDepartmentActive(row, value)}
                >
                  {row.is_active ? '已激活' : '未激活'}
                </Switch>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <AdminTableSummary total={total} page={page} totalPages={totalPages} unit="条" />
    </div>
  )
}
