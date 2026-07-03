'use client'

import { showResultError } from '@/core/client/errors'
import {
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from '@heroui/react'
import { loadWeeklyDeptDetailsAction } from '@/modules/stats/actions'
import type { WeeklyDeptDetailRow, DeptOption, WeekOptionLite } from '@/modules/stats/types'
import { ExportCsvButton } from '@/modules/stats/components/shared/export-csv-button'
import {
  WeeklyStatsFilters,
  type WeeklyStatsFiltersState,
} from '@/modules/stats/components/weekly/weekly-stats-filters'

export default function WeeklyStatsDetailsClient({
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
  const [rows, setRows] = useState<WeeklyDeptDetailRow[]>([])
  const [loading, setLoading] = useState(false)

  const runQuery = useCallback(async (s: WeeklyStatsFiltersState) => {
    setLoading(true)
    const result = await loadWeeklyDeptDetailsAction(
      s.departmentId,
      s.weekCode,
      s.personKeyword || null,
      s.projectKeyword || null
    )
    setLoading(false)
    if (!result.success) {
      showResultError(result, '加载失败')
      setRows([])
      return
    }
    setRows(result.data)
  }, [])

  useEffect(() => {
    if (initialDepartmentId && initialWeekCode) {
      // 挂载时按服务端初值拉取统计（外部数据同步）
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
      '填写人',
      '项目名称',
      '周次',
      '工作天数',
      '工作事项数',
      '状态',
      '提交时间',
      '审批时间',
      '提交逾期',
      '审批逾期',
    ]
    const body = rows.map((r) => [
      r.user_name,
      r.project_name ?? '—',
      r.week_code,
      String(r.work_days),
      String(r.item_count),
      r.status,
      r.submitted_at ?? '—',
      r.approved_at ?? '—',
      r.submit_overdue,
      r.approval_overdue,
    ])
    return { headers, body }
  }, [rows])

  return (
    <div className={cn('space-y-4', !embedded && 'p-4 md:p-6')}>
      {!embedded ? (
        <h1 className="text-xl font-semibold tracking-tight">周报明细</h1>
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
          filename="周报统计-明细.csv"
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
            aria-label="周报明细"
            removeWrapper
            classNames={{
              wrapper: 'min-w-[1400px]',
              th: 'bg-default-100/80 px-3 py-2 text-xs text-default-600 whitespace-nowrap sticky top-0 z-10',
              td: 'border-b border-default-100 px-3 py-2 text-sm',
            }}
          >
            <TableHeader>
              <TableColumn>填写人</TableColumn>
              <TableColumn>项目名称</TableColumn>
              <TableColumn>周次</TableColumn>
              <TableColumn>天数</TableColumn>
              <TableColumn>事项数</TableColumn>
              <TableColumn>状态</TableColumn>
              <TableColumn>提交时间</TableColumn>
              <TableColumn>审批时间</TableColumn>
              <TableColumn>提交逾期</TableColumn>
              <TableColumn>审批逾期</TableColumn>
            </TableHeader>
            <TableBody emptyContent="暂无数据">
              {rows.map((r) => (
                <TableRow key={r.report_id}>
                  <TableCell className="min-w-[88px]">{r.user_name}</TableCell>
                  <TableCell className="min-w-[240px] max-w-[min(480px,50vw)]">
                    <span className="line-clamp-2">{r.project_name ?? '—'}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{r.week_code}</TableCell>
                  <TableCell className="tabular-nums">{r.work_days}</TableCell>
                  <TableCell className="tabular-nums">{r.item_count}</TableCell>
                  <TableCell>{r.status}</TableCell>
                  <TableCell className="whitespace-nowrap text-default-600">
                    {r.submitted_at ?? '—'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-default-600">
                    {r.approved_at ?? '—'}
                  </TableCell>
                  <TableCell>{r.submit_overdue}</TableCell>
                  <TableCell>{r.approval_overdue}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
