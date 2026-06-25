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
import { loadWeeklyDeptByProjectAction } from '@/modules/stats/actions'
import type { WeeklyDeptByProjectRow, DeptOption, WeekOptionLite } from '@/modules/stats/types'
import { PROJECT_STATUS_LABEL } from '@/constants/project-status'
import { ExportCsvButton } from '@/modules/stats/components/shared/export-csv-button'
import {
  WeeklyStatsFilters,
  type WeeklyStatsFiltersState,
} from '@/modules/stats/components/weekly/weekly-stats-filters'

export default function WeeklyStatsByProjectClient({
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
  const [rows, setRows] = useState<WeeklyDeptByProjectRow[]>([])
  const [loading, setLoading] = useState(false)

  const runQuery = useCallback(async (s: WeeklyStatsFiltersState) => {
    setLoading(true)
    const result = await loadWeeklyDeptByProjectAction(
      s.departmentId,
      s.weekCode,
      s.personKeyword || null,
      s.projectKeyword || null
    )
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
      '项目名称',
      '状态',
      '无工作',
      '周报数',
      '待审批',
      '合计天数',
    ]
    const body = rows.map((r) => [
      r.project_name ?? '—',
      r.project_status
        ? (PROJECT_STATUS_LABEL as Record<string, string>)[r.project_status] ??
          r.project_status
        : '—',
      r.no_work_exemption ? '无工作' : '',
      String(r.report_count),
      String(r.pending_count),
      String(r.total_work_days),
    ])
    return { headers, body }
  }, [rows])

  return (
    <div className={cn('space-y-4', !embedded && 'p-4 md:p-6')}>
      {!embedded ? (
        <h1 className="text-xl font-semibold tracking-tight">按项目统计</h1>
      ) : null}

      <WeeklyStatsFilters
        departmentOptions={departmentOptions}
        weekOptions={weekOptions}
        initialDepartmentId={initialDepartmentId}
        initialWeekCode={initialWeekCode}
        showPersonSearch={false}
        showProjectSearch
        loading={loading}
        onApply={runQuery}
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <ExportCsvButton
          filename="周报统计-按项目.csv"
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
            aria-label="按项目统计"
            removeWrapper
            classNames={{
              wrapper: 'min-w-[1000px]',
              th: 'bg-default-100/80 px-3 py-2 text-xs text-default-600 whitespace-nowrap sticky top-0 z-10',
              td: 'border-b border-default-100 px-3 py-2',
            }}
          >
            <TableHeader>
              <TableColumn>项目名称</TableColumn>
              <TableColumn>状态</TableColumn>
              <TableColumn>无工作</TableColumn>
              <TableColumn>周报数</TableColumn>
              <TableColumn>待审批</TableColumn>
              <TableColumn>合计天数</TableColumn>
            </TableHeader>
            <TableBody emptyContent="暂无数据">
              {rows.map((r) => (
                <TableRow key={r.project_id}>
                  <TableCell className="min-w-[260px] max-w-[min(520px,55vw)] font-medium">
                    <span className="line-clamp-2">{r.project_name ?? '—'}</span>
                  </TableCell>
                  <TableCell>
                    {r.project_status
                      ? PROJECT_STATUS_LABEL[
                          r.project_status as keyof typeof PROJECT_STATUS_LABEL
                        ] ?? r.project_status
                      : '—'}
                  </TableCell>
                  <TableCell>
                    {r.no_work_exemption ? (
                      <Chip size="sm" variant="flat" color="warning">
                        无工作
                      </Chip>
                    ) : null}
                  </TableCell>
                  <TableCell className="tabular-nums">{r.report_count}</TableCell>
                  <TableCell className="tabular-nums">{r.pending_count}</TableCell>
                  <TableCell className="tabular-nums">{r.total_work_days}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
