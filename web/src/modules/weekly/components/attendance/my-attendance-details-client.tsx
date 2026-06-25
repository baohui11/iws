'use client'

import {
  Button,
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
import { loadMyAttendanceDetailsAction } from '@/modules/stats/actions'
import type { AttendanceDetailRow } from '@/modules/stats/types'
import { ExportCsvButton } from '@/modules/stats/components/shared/export-csv-button'
import { StatsLabelField } from '@/modules/stats/components/shared/stats-label-field'
import { StatsYearMonthSelect } from '@/modules/stats/components/shared/stats-year-month-select'

export default function MyAttendanceDetailsClient({
  initialYearMonth,
}: {
  initialYearMonth: string
}) {
  const [yearMonth, setYearMonth] = useState(initialYearMonth)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<AttendanceDetailRow[]>([])

  const runQuery = useCallback(async () => {
    setLoading(true)
    const result = await loadMyAttendanceDetailsAction(yearMonth)
    setLoading(false)
    if (!result.success) {
      addToast({
        title: '加载失败',
        description: result.message,
        color: 'danger',
      })
      setRows([])
      return
    }
    setRows(result.data)
  }, [yearMonth])

  useEffect(() => {
    void runQuery()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const csv = useMemo(() => {
    const headers = [
      '项目',
      '周次',
      '工作内容',
      '本月天数',
      '原始天数',
      '工作日期范围',
    ]
    const body = rows.map((r) => [
      r.project_name ?? '—',
      r.week_label,
      r.work_content.replace(/\n/g, ' '),
      String(r.work_days),
      String(r.original_work_days),
      r.date_range,
    ])
    return { headers, body }
  }, [rows])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-default-200/80 bg-default-50/50 p-3">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2">
          <StatsLabelField label="月份" className="sm:min-w-[min(100%,14rem)]">
            <StatsYearMonthSelect value={yearMonth} onChange={setYearMonth} />
          </StatsLabelField>

          <div className="flex w-full justify-end sm:ml-auto sm:w-auto">
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
          filename={`我的考勤明细-${yearMonth}.csv`}
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
            aria-label="我的考勤明细"
            removeWrapper
            classNames={{
              wrapper: 'min-w-[1000px]',
              th: 'bg-default-100/80 px-3 py-2 text-xs text-default-600 whitespace-nowrap sticky top-0 z-10',
              td: 'border-b border-default-100 px-3 py-2 text-sm align-top',
            }}
          >
            <TableHeader>
              <TableColumn>项目</TableColumn>
              <TableColumn>周次</TableColumn>
              <TableColumn>工作内容</TableColumn>
              <TableColumn>本月天数</TableColumn>
              <TableColumn>原始天数</TableColumn>
              <TableColumn className="w-[7rem] max-w-[7rem]">工作日期范围</TableColumn>
            </TableHeader>
            <TableBody emptyContent="暂无数据">
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="min-w-[120px] max-w-[min(240px,28vw)]">
                    <span className="line-clamp-2">{r.project_name ?? '—'}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{r.week_label}</TableCell>
                  <TableCell className="min-w-[260px] max-w-[min(520px,55vw)]">
                    <span className="whitespace-pre-wrap break-words">{r.work_content}</span>
                  </TableCell>
                  <TableCell className="tabular-nums">{r.work_days}</TableCell>
                  <TableCell className="tabular-nums text-default-600">
                    {r.original_work_days}
                  </TableCell>
                  <TableCell className="w-[7rem] max-w-[7rem] px-2 text-xs text-default-600">
                    <span className="line-clamp-2 break-all">{r.date_range}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
