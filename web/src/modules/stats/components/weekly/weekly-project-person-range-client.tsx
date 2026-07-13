'use client'

import { showResultError } from '@/core/client/errors'
import {
  Button,
  Input,
  Select,
  SelectItem,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react'
import { Icon } from '@iconify/react'
import { useCallback, useMemo, useState } from 'react'
import { loadWeeklyProjectPersonRangeAction } from '@/modules/stats/actions'
import { ExportCsvButton } from '@/modules/stats/components/shared/export-csv-button'
import { StatsLabelField } from '@/modules/stats/components/shared/stats-label-field'
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
  const [rows, setRows] = useState<WeeklyProjectPersonRangeRow[]>([])
  const [loading, setLoading] = useState(false)

  const weekItems = useMemo(
    () =>
      weekOptions.map((week) => ({
        id: week.week_code,
        label: `${week.title_zh}（${week.range_line}）`,
      })),
    [weekOptions]
  )

  const rangeWeeks = useMemo(
    () => weekRangeCodes(weekOptions, weekCodeFrom, weekCodeTo),
    [weekCodeFrom, weekCodeTo, weekOptions]
  )

  const runQuery = useCallback(async () => {
    setLoading(true)
    const result = await loadWeeklyProjectPersonRangeAction({
      departmentId,
      projectKeyword,
      projectStage: projectStage || null,
      weekCodeFrom,
      weekCodeTo,
      personNameKeyword: personKeyword || null,
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
    personKeyword,
    projectKeyword,
    projectStage,
    weekCodeFrom,
    weekCodeTo,
  ])

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
      <div className="flex flex-col gap-3 rounded-lg border border-default-200/80 bg-default-50/50 p-3">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-4 lg:gap-y-2">
          <StatsLabelField label="部门" className="lg:min-w-[min(100%,22rem)]">
            <Select
              aria-label="部门"
              size="sm"
              variant="bordered"
              className="w-full min-w-[12rem] max-w-[22rem]"
              selectedKeys={departmentId ? new Set([departmentId]) : new Set()}
              items={departmentOptions}
              onSelectionChange={(keys) => {
                const k = [...keys][0] as string | undefined
                if (k) setDepartmentId(k)
              }}
            >
              {(item) => (
                <SelectItem key={item.id} textValue={item.label}>
                  {item.label}
                </SelectItem>
              )}
            </Select>
          </StatsLabelField>

          <StatsLabelField label="开始周" className="lg:min-w-[min(100%,22rem)]">
            <Select
              aria-label="开始周"
              size="sm"
              variant="bordered"
              className="w-full min-w-[14rem] max-w-[22rem]"
              selectedKeys={weekCodeFrom ? new Set([weekCodeFrom]) : new Set()}
              items={weekItems}
              onSelectionChange={(keys) => {
                const k = [...keys][0] as string | undefined
                if (k) setWeekCodeFrom(k)
              }}
            >
              {(item) => (
                <SelectItem key={item.id} textValue={item.label}>
                  {item.label}
                </SelectItem>
              )}
            </Select>
          </StatsLabelField>

          <StatsLabelField label="结束周" className="lg:min-w-[min(100%,22rem)]">
            <Select
              aria-label="结束周"
              size="sm"
              variant="bordered"
              className="w-full min-w-[14rem] max-w-[22rem]"
              selectedKeys={weekCodeTo ? new Set([weekCodeTo]) : new Set()}
              items={weekItems}
              onSelectionChange={(keys) => {
                const k = [...keys][0] as string | undefined
                if (k) setWeekCodeTo(k)
              }}
            >
              {(item) => (
                <SelectItem key={item.id} textValue={item.label}>
                  {item.label}
                </SelectItem>
              )}
            </Select>
          </StatsLabelField>

          <StatsLabelField label="项目" className="lg:min-w-[min(100%,20rem)]">
            <Input
              aria-label="项目名称或编号"
              size="sm"
              variant="bordered"
              className="w-full min-w-[14rem] max-w-[20rem]"
              value={projectKeyword}
              onValueChange={setProjectKeyword}
              placeholder="名称或编号"
            />
          </StatsLabelField>

          <StatsLabelField label="阶段" className="lg:min-w-[min(100%,12rem)]">
            <Select
              aria-label="项目阶段"
              size="sm"
              variant="bordered"
              className="w-full min-w-[10rem] max-w-[12rem]"
              selectedKeys={new Set([projectStage || 'all'])}
              onSelectionChange={(keys) => {
                const k = [...keys][0] as string | undefined
                setProjectStage(!k || k === 'all' ? '' : k)
              }}
            >
              <SelectItem key="all">全部阶段</SelectItem>
              <SelectItem key="实施阶段">实施阶段</SelectItem>
              <SelectItem key="销售阶段">销售阶段</SelectItem>
            </Select>
          </StatsLabelField>

          <StatsLabelField label="姓名" className="lg:min-w-[min(100%,16rem)]">
            <Input
              aria-label="姓名模糊"
              size="sm"
              variant="bordered"
              className="w-full min-w-[10rem] max-w-[16rem]"
              value={personKeyword}
              onValueChange={setPersonKeyword}
              placeholder="模糊"
            />
          </StatsLabelField>

          <div className="flex w-full justify-end lg:ml-auto lg:w-auto">
            <Button
              color="primary"
              size="sm"
              isLoading={loading}
              isDisabled={!projectKeyword.trim()}
              startContent={
                <Icon icon="lucide:search" className="size-4" aria-hidden />
              }
              onPress={() => void runQuery()}
            >
              查询
            </Button>
          </div>
        </div>
      </div>

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
