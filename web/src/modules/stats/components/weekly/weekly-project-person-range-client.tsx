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
import { loadWeeklyProjectPersonRangeAction } from '@/modules/stats/actions'
import { ExportCsvButton } from '@/modules/stats/components/shared/export-csv-button'
import {
  StatsDepartmentSelect,
  StatsFilterBar,
  StatsProjectStageSelect,
  StatsTextFilter,
  StatsWeekSelect,
  useDebouncedValue,
} from '@/modules/stats/components/shared/stats-filter-controls'
import type {
  DeptOption,
  WeekOptionLite,
  WeeklyProjectPersonRangeRow,
} from '@/modules/stats/types'

function weekRangeCodes(
  weekOptions: WeekOptionLite[],
  from: string,
  to: string
) {
  const codes = weekOptions.map((week) => week.week_code)
  const a = codes.indexOf(from)
  const b = codes.indexOf(to)
  if (a < 0 || b < 0) return []
  const start = Math.min(a, b)
  const end = Math.max(a, b)
  return codes.slice(start, end + 1)
}

export default function WeeklyProjectPersonRangeClient({
  departmentOptions,
  weekOptions,
  initialDepartmentId,
  initialWeekCode,
}: {
  departmentOptions: DeptOption[]
  weekOptions: WeekOptionLite[]
  initialDepartmentId: string
  initialWeekCode: string
}) {
  const [departmentId, setDepartmentId] = useState(initialDepartmentId)
  const [weekCodeFrom, setWeekCodeFrom] = useState(initialWeekCode)
  const [weekCodeTo, setWeekCodeTo] = useState(initialWeekCode)
  const [projectKeyword, setProjectKeyword] = useState('')
  const [personKeyword, setPersonKeyword] = useState('')
  const [projectStage, setProjectStage] = useState('')
  const debouncedProjectKeyword = useDebouncedValue(projectKeyword)
  const debouncedPersonKeyword = useDebouncedValue(personKeyword)
  const [rows, setRows] = useState<WeeklyProjectPersonRangeRow[]>([])
  const [loading, setLoading] = useState(false)

  const rangeWeeks = useMemo(
    () => weekRangeCodes(weekOptions, weekCodeFrom, weekCodeTo),
    [weekCodeFrom, weekCodeTo, weekOptions]
  )

  const runQuery = useCallback(async () => {
    setLoading(true)
    const result = await loadWeeklyProjectPersonRangeAction({
      departmentId,
      projectKeyword: debouncedProjectKeyword,
      projectStage: projectStage || null,
      weekCodeFrom,
      weekCodeTo,
      personNameKeyword: debouncedPersonKeyword || null,
    })
    setLoading(false)
    if (!result.success) {
      showResultError(result, '加载失败')
      setRows([])
      return
    }
    setRows(result.data)
  }, [
    departmentId,
    debouncedPersonKeyword,
    debouncedProjectKeyword,
    projectStage,
    weekCodeFrom,
    weekCodeTo,
  ])

  useEffect(() => {
    if (!departmentId || !weekCodeFrom || !weekCodeTo) return
    void runQuery()
  }, [departmentId, runQuery, weekCodeFrom, weekCodeTo])

  const csv = useMemo(() => {
    const headers = [
      '姓名',
      '工号',
      '部门',
      '角色',
      '项目阶段',
      ...rangeWeeks,
      '合计天数',
      '已填周数',
      '缺报周数',
      '最近提交',
    ]
    const body = rows.map((row) => [
      row.user_name,
      row.employee_no ?? '',
      row.department_name ?? '',
      row.project_roles || '',
      row.project_stage,
      ...rangeWeeks.map((week) => String(row.week_days[week] ?? 0)),
      String(row.total_work_days),
      String(row.submitted_week_count),
      String(row.missing_week_count),
      row.latest_submitted_at ?? '',
    ])
    return { headers, body }
  }, [rangeWeeks, rows])

  const columns = useMemo(
    () => [
      { key: 'user_name', label: '姓名' },
      { key: 'department_name', label: '部门' },
      { key: 'project_roles', label: '角色' },
      { key: 'project_stage', label: '阶段' },
      ...rangeWeeks.map((week) => ({ key: `week:${week}`, label: week })),
      { key: 'total_work_days', label: '合计' },
      { key: 'submitted_week_count', label: '已填周数' },
      { key: 'missing_week_count', label: '缺报周数' },
      { key: 'latest_submitted_at', label: '最近提交' },
    ],
    [rangeWeeks]
  )

  function renderCell(row: WeeklyProjectPersonRangeRow, key: string) {
    if (key.startsWith('week:')) {
      const week = key.slice(5)
      return <span className="tabular-nums">{row.week_days[week] ?? 0}</span>
    }
    switch (key) {
      case 'user_name':
        return <span className="font-medium">{row.user_name}</span>
      case 'department_name':
        return row.department_name ?? '—'
      case 'project_roles':
        return row.project_roles || '—'
      case 'project_stage':
        return row.project_stage
      case 'total_work_days':
        return <span className="font-medium tabular-nums">{row.total_work_days}</span>
      case 'submitted_week_count':
        return <span className="tabular-nums">{row.submitted_week_count}</span>
      case 'missing_week_count':
        return <span className="tabular-nums">{row.missing_week_count}</span>
      case 'latest_submitted_at':
        return (
          <span className="whitespace-nowrap text-default-600">
            {row.latest_submitted_at ?? '—'}
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
      <StatsFilterBar>
        <StatsDepartmentSelect
          value={departmentId}
          onChange={setDepartmentId}
          departmentOptions={departmentOptions}
          includeAll={departmentOptions.length > 1}
        />
        <StatsWeekSelect
          label="开始周"
          value={weekCodeFrom}
          onChange={setWeekCodeFrom}
          weekOptions={weekOptions}
        />
        <StatsWeekSelect
          label="结束周"
          value={weekCodeTo}
          onChange={setWeekCodeTo}
          weekOptions={weekOptions}
        />
        <StatsTextFilter
          label="项目"
          value={projectKeyword}
          onChange={setProjectKeyword}
          placeholder="名称或编号"
        />
        <StatsProjectStageSelect value={projectStage} onChange={setProjectStage} />
        <StatsTextFilter label="姓名" value={personKeyword} onChange={setPersonKeyword} />
      </StatsFilterBar>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <ExportCsvButton
          filename="项目人员周区间统计.csv"
          headers={csv.headers}
          rows={csv.body}
          disabled={loading}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner label="加载中..." />
        </div>
      ) : (
        <div className="max-h-[min(75vh,800px)] overflow-auto rounded-lg border border-default-200/80">
          <Table
            aria-label="项目人员周区间统计"
            removeWrapper
            classNames={{
              wrapper: 'min-w-[1200px]',
              th: 'bg-default-100/80 px-3 py-2 text-xs text-default-600 whitespace-nowrap sticky top-0 z-10',
              td: 'border-b border-default-100 px-3 py-2 text-sm',
            }}
          >
            <TableHeader columns={columns}>
              {(column) => (
                <TableColumn key={column.key}>{column.label}</TableColumn>
              )}
            </TableHeader>
            <TableBody items={rows} emptyContent="暂无数据">
              {(row) => (
                <TableRow key={`${row.user_id}:${row.project_stage}`}>
                  {(columnKey) => (
                    <TableCell>{renderCell(row, String(columnKey))}</TableCell>
                  )}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
