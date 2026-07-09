'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  addToast,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react'
import { showErrorToast, showResultError } from '@/core/client/errors'
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
  const savingActiveIdsRef = useRef(new Set<string>())

  const fetchPage = useCallback(
    async (p: number, kw: string) => {
      setIsLoading(true)
      try {
        const result = await listDepartments({
          page: p,
          pageSize,
          keyword: kw.trim() || undefined,
        })
        if (result.success && result.data) {
          setRows(result.data.departments)
          setTotal(result.data.total)
        } else {
          showResultError(result, '加载失败')
        }
      } catch (error) {
        showErrorToast({ title: '加载失败', error })
      } finally {
        setIsLoading(false)
      }
    },
    [pageSize]
  )

  const skipFirstPage = useRef(true)
  useEffect(() => {
    if (skipFirstPage.current) {
      skipFirstPage.current = false
      return
    }
    void fetchPage(page, keyword)
    // 翻页只由 page 触发；关键词变化走下面的防抖刷新。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const skipFirstKeyword = useRef(true)
  useEffect(() => {
    if (skipFirstKeyword.current) {
      skipFirstKeyword.current = false
      return
    }
    const timer = window.setTimeout(() => {
      if (page !== 1) {
        setPage(1)
        return
      }
      void fetchPage(1, keyword)
    }, 300)
    return () => window.clearTimeout(timer)
    // 只让关键词输入触发防抖刷新；翻页仍走分页 effect。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword])

  const handleSearch = () => {
    if (page !== 1) {
      setPage(1)
      return
    }
    void fetchPage(1, keyword)
  }

  const setDepartmentActive = async (
    row: DepartmentWithRelations,
    isActive: boolean
  ) => {
    if (savingActiveIdsRef.current.has(row.id)) return

    const previous = row.is_active
    savingActiveIdsRef.current.add(row.id)
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
    } catch (error) {
      setRows((current) =>
        current.map((item) =>
          item.id === row.id ? { ...item, is_active: previous } : item
        )
      )
      showErrorToast({ title: '保存失败', error })
    } finally {
      savingActiveIdsRef.current.delete(row.id)
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
        searchPlaceholder="搜索名称或编码..."
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
          emptyContent={<div className="py-8 text-default-400">暂无部门数据</div>}
          isLoading={isLoading}
          loadingContent={<div className="py-8">加载中...</div>}
        >
          {(row) => (
            <TableRow key={row.id}>
              <TableCell>{row.code}</TableCell>
              <TableCell>{row.name}</TableCell>
              <TableCell>{row.parent_name ?? '-'}</TableCell>
              <TableCell>{row.leader_name ?? '-'}</TableCell>
              <TableCell>{row.level ?? '-'}</TableCell>
              <TableCell>
                <Switch
                  size="sm"
                  isSelected={row.is_active}
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
