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
import { loadAttendanceProjectSummaryAction } from '@/modules/stats/actions'
import type { AttendanceProjectSummaryRow } from '@/modules/stats/types'
import { ExportCsvButton } from '@/modules/stats/components/shared/export-csv-button'
import {
  StatsDepartmentSelect,
  StatsFilterBar,
  StatsMonthFilter,
} from '@/modules/stats/components/shared/stats-filter-controls'
import type { DeptOption } from '@/modules/stats/types'

export default function AttendanceProjectSummaryClient({
  departmentOptions,
  initialDepartmentId,
  initialYearMonth,
}: {
  departmentOptions: DeptOption[]
  initialDepartmentId: string
  initialYearMonth: string
}) {
  const [departmentId, setDepartmentId] = useState(initialDepartmentId)
  const [yearMonth, setYearMonth] = useState(initialYearMonth)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<AttendanceProjectSummaryRow[]>([])

  const runQuery = useCallback(async () => {
    setLoading(true)
    const result = await loadAttendanceProjectSummaryAction(departmentId, yearMonth)
    setLoading(false)
    if (!result.success) {
      showResultError(result, '加载失败')
      setRows([])
      return
    }
    setRows(result.data)
  }, [departmentId, yearMonth])

  useEffect(() => {
    void runQuery()
  }, [runQuery])

  const csv = useMemo(() => {
    const headers = ['姓名', '所属部门', '工号', '项目', '本月天数']
    const body = rows.map((r) => [
      r.user_name,
      r.department_name ?? '—',
      r.employee_no ?? '—',
      r.project_name ?? '—',
      String(r.work_days),
    ])
    return { headers, body }
  }, [rows])

  return (
    <div className="space-y-4">
      <StatsFilterBar>
        <StatsDepartmentSelect
          value={departmentId}
          onChange={setDepartmentId}
          departmentOptions={departmentOptions}
          includeAll={departmentOptions.length > 1}
        />
        <StatsMonthFilter value={yearMonth} onChange={setYearMonth} />
      </StatsFilterBar>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <ExportCsvButton
          filename={`考勤统计-项目汇总-${yearMonth}.csv`}
          headers={csv.headers}
          rows={csv.body}
          disabled={loading || rows.length === 0}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner label="加载中…" />
        </div>
      ) : (
        <div className="max-h-[min(75vh,800px)] overflow-auto rounded-lg border border-default-200/80">
          <Table
            aria-label="项目汇总考勤"
            removeWrapper
            classNames={{
              wrapper: 'min-w-[720px]',
              th: 'bg-default-100/80 px-3 py-2 text-xs text-default-600 whitespace-nowrap sticky top-0 z-10',
              td: 'border-b border-default-100 px-3 py-2',
            }}
          >
            <TableHeader>
              <TableColumn>姓名</TableColumn>
              <TableColumn>所属部门</TableColumn>
              <TableColumn>工号</TableColumn>
              <TableColumn>项目</TableColumn>
              <TableColumn>本月天数</TableColumn>
            </TableHeader>
            <TableBody emptyContent="暂无数据">
              {rows.map((r) => (
                <TableRow key={`${r.user_id}-${r.project_id}`}>
                  <TableCell className="font-medium">{r.user_name}</TableCell>
                  <TableCell className="min-w-[160px] max-w-[min(320px,35vw)] text-default-600">
                    <span className="line-clamp-2">{r.department_name ?? '—'}</span>
                  </TableCell>
                  <TableCell className="tabular-nums text-default-600">
                    {r.employee_no ?? '—'}
                  </TableCell>
                  <TableCell className="min-w-[200px] max-w-[min(420px,50vw)]">
                    <span className="line-clamp-2">{r.project_name ?? '—'}</span>
                  </TableCell>
                  <TableCell className="tabular-nums">{r.work_days}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
