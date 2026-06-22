'use client'

import {
  Button,
  Select,
  SelectItem,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  addToast,
} from '@heroui/react'
import { Icon } from '@iconify/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadAttendanceProjectSummary } from '@/actions/stats/attendance-stats.action'
import type { AttendanceProjectSummaryRow } from '@/types/stats'
import { ExportCsvButton } from '@/components/stats/export-csv-button'
import { StatsLabelField } from '@/components/stats/stats-label-field'
import { StatsYearMonthSelect } from '@/components/stats/stats-year-month-select'
import type { DeptOption } from '@/components/stats/weekly-stats-filters'

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
    const result = await loadAttendanceProjectSummary(departmentId, yearMonth)
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
    setRows(result.data as AttendanceProjectSummaryRow[])
  }, [departmentId, yearMonth])

  useEffect(() => {
    void runQuery()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅首次进入；筛选请点「查询」
  }, [])

  const csv = useMemo(() => {
    const headers = ['姓名', '工号', '项目', '本月天数']
    const body = rows.map((r) => [
      r.user_name,
      r.employee_no ?? '—',
      r.project_name ?? '—',
      String(r.work_days),
    ])
    return { headers, body }
  }, [rows])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-default-200/80 bg-default-50/50 p-3">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-4 lg:gap-y-2">
          <StatsLabelField label="部门" className="lg:min-w-[min(100%,22rem)]">
            <Select
              aria-label="部门"
              size="sm"
              variant="bordered"
              className="w-full min-w-[12rem] max-w-[22rem]"
              selectedKeys={departmentId ? new Set([departmentId]) : new Set()}
              onSelectionChange={(keys) => {
                const k = [...keys][0] as string | undefined
                if (k) setDepartmentId(k)
              }}
              items={departmentOptions}
            >
              {(item) => (
                <SelectItem key={item.id} textValue={item.label}>
                  {item.label}
                </SelectItem>
              )}
            </Select>
          </StatsLabelField>

          <StatsLabelField label="月份" className="lg:min-w-[min(100%,14rem)]">
            <StatsYearMonthSelect value={yearMonth} onChange={setYearMonth} />
          </StatsLabelField>

          <div className="flex w-full justify-end lg:ml-auto lg:w-auto">
            <Button
              color="primary"
              size="sm"
              className="font-medium"
              isLoading={loading}
              startContent={<Icon icon="lucide:search" className="size-4" aria-hidden />}
              onPress={() => void runQuery()}
            >
              查询
            </Button>
          </div>
        </div>
      </div>

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
              <TableColumn>工号</TableColumn>
              <TableColumn>项目</TableColumn>
              <TableColumn>本月天数</TableColumn>
            </TableHeader>
            <TableBody emptyContent="暂无数据">
              {rows.map((r) => (
                <TableRow key={`${r.user_id}-${r.project_id}`}>
                  <TableCell className="font-medium">{r.user_name}</TableCell>
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
