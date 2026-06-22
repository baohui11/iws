'use client'

import {
  Chip,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  addToast,
} from '@heroui/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from '@heroui/react'
import { loadWeeklyDeptByPerson } from '@/actions/stats/weekly-stats.action'
import type { WeeklyDeptByPersonRow } from '@/types/stats'
import { ExportCsvButton } from '@/components/stats/export-csv-button'
import {
  WeeklyStatsFilters,
  type DeptOption,
  type WeekOptionLite,
  type WeeklyStatsFiltersState,
} from '@/components/stats/weekly-stats-filters'

export default function WeeklyStatsByPersonClient({
  embedded = false,
  departmentOptions,
  weekOptions,
  initialDepartmentId,
  initialWeekCode,
}: {
  embedded?: boolean
  departmentOptions: DeptOption[]
  weekOptions: WeekOptionLite[]
  initialDepartmentId: string
  initialWeekCode: string
}) {
  const [rows, setRows] = useState<WeeklyDeptByPersonRow[]>([])
  const [loading, setLoading] = useState(false)

  const runQuery = useCallback(async (s: WeeklyStatsFiltersState) => {
    setLoading(true)
    const result = await loadWeeklyDeptByPerson(
      s.departmentId,
      s.weekCode,
      s.personKeyword || null,
      s.projectKeyword || null
    )
    setLoading(false)
    if (!result.success || !result.data) {
      addToast({
        title: '加载失败',
        description: result.message,
        color: 'danger',
      })
      setRows([])
      return
    }
    setRows(result.data)
  }, [])

  useEffect(() => {
    if (initialDepartmentId && initialWeekCode) {
      void runQuery({
        departmentId: initialDepartmentId,
        weekCode: initialWeekCode,
        personKeyword: '',
        projectKeyword: '',
      })
    }
  }, [initialDepartmentId, initialWeekCode, runQuery])

  const csv = useMemo(() => {
    const headers = [
      '姓名',
      '工作天数',
      '参与项目数',
      '上传文件数',
      '周报状态',
    ]
    const body = rows.map((r) => {
      let status = '已填'
      if (!r.has_dept_project) {
        status = '无部门项目'
      } else if (!r.has_report) {
        status = '未填周报'
      }
      return [
        r.user_name,
        String(r.work_days),
        String(r.project_count),
        String(r.file_upload_count),
        status,
      ]
    })
    return { headers, body }
  }, [rows])

  return (
    <div className={cn('space-y-4', !embedded && 'p-4 md:p-6')}>
      {!embedded ? (
        <h1 className="text-xl font-semibold tracking-tight">按人员统计</h1>
      ) : null}

      <WeeklyStatsFilters
        departmentOptions={departmentOptions}
        weekOptions={weekOptions}
        initialDepartmentId={initialDepartmentId}
        initialWeekCode={initialWeekCode}
        showPersonSearch
        showProjectSearch
        loading={loading}
        onApply={runQuery}
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <ExportCsvButton
          filename="周报统计-按人员.csv"
          headers={csv.headers}
          rows={csv.body}
          disabled={loading}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner label="加载中…" />
        </div>
      ) : (
        <div className="max-h-[min(75vh,800px)] overflow-auto rounded-lg border border-default-200/80">
          <Table
            aria-label="按人员统计"
            removeWrapper
            classNames={{
              wrapper: 'min-w-[920px]',
              th: 'bg-default-100/80 px-3 py-2 text-xs text-default-600 whitespace-nowrap sticky top-0 z-10',
              td: 'border-b border-default-100 px-3 py-2',
            }}
          >
            <TableHeader>
              <TableColumn>姓名</TableColumn>
              <TableColumn>工作天数</TableColumn>
              <TableColumn>参与项目数</TableColumn>
              <TableColumn>上传文件数</TableColumn>
              <TableColumn>周报</TableColumn>
            </TableHeader>
            <TableBody emptyContent="暂无数据">
              {rows.map((r) => {
                let tag: { label: string; color: 'success' | 'warning' | 'default' }
                if (!r.has_dept_project) {
                  tag = { label: '无部门项目', color: 'default' }
                } else if (!r.has_report) {
                  tag = { label: '未填周报', color: 'warning' }
                } else {
                  tag = { label: '已填', color: 'success' }
                }
                return (
                  <TableRow key={r.user_id}>
                    <TableCell className="font-medium">{r.user_name}</TableCell>
                    <TableCell className="tabular-nums">{r.work_days}</TableCell>
                    <TableCell className="tabular-nums">{r.project_count}</TableCell>
                    <TableCell className="tabular-nums">{r.file_upload_count}</TableCell>
                    <TableCell>
                      <Chip size="sm" variant="flat" color={tag.color}>
                        {tag.label}
                      </Chip>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
