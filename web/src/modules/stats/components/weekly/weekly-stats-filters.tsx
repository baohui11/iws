'use client'

import { Button, Input, Select, SelectItem } from '@heroui/react'
import { Icon } from '@iconify/react'
import { useCallback, useMemo, useState } from 'react'
import { StatsLabelField } from '@/modules/stats/components/shared/stats-label-field'
import type { DeptOption } from '@/modules/stats/types'

export interface WeekOptionLite {
  week_code: string
  title_zh: string
  range_line: string
}

export interface WeeklyStatsFiltersState {
  departmentId: string
  weekCode: string
  personKeyword: string
  projectKeyword: string
  projectStage: string
}

export function WeeklyStatsFilters({
  departmentOptions,
  weekOptions,
  initialDepartmentId,
  initialWeekCode,
  showPersonSearch,
  showProjectSearch,
  onApply,
  loading,
}: {
  departmentOptions: DeptOption[]
  weekOptions: WeekOptionLite[]
  initialDepartmentId: string
  initialWeekCode: string
  showPersonSearch: boolean
  showProjectSearch: boolean
  onApply: (s: WeeklyStatsFiltersState) => void
  loading?: boolean
}) {
  const [departmentId, setDepartmentId] = useState(initialDepartmentId)
  const [weekCode, setWeekCode] = useState(initialWeekCode)
  const [personKeyword, setPersonKeyword] = useState('')
  const [projectKeyword, setProjectKeyword] = useState('')
  const [projectStage, setProjectStage] = useState('')

  const weekItems = useMemo(
    () =>
      weekOptions.map((w) => ({
        id: w.week_code,
        label: `${w.title_zh}（${w.range_line}）`,
      })),
    [weekOptions]
  )

  const apply = useCallback(() => {
    onApply({
      departmentId,
      weekCode,
      personKeyword: personKeyword.trim(),
      projectKeyword: projectKeyword.trim(),
      projectStage,
    })
  }, [departmentId, weekCode, personKeyword, projectKeyword, projectStage, onApply])

  return (
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

        <StatsLabelField label="周次" className="lg:min-w-[min(100%,26rem)]">
          <Select
            aria-label="周次"
            size="sm"
            variant="bordered"
            className="w-full min-w-[14rem] max-w-[26rem]"
            selectedKeys={weekCode ? new Set([weekCode]) : new Set()}
            onSelectionChange={(keys) => {
              const k = [...keys][0] as string | undefined
              if (k) setWeekCode(k)
            }}
            items={weekItems}
          >
            {(item) => (
              <SelectItem key={item.id} textValue={item.label}>
                {item.label}
              </SelectItem>
            )}
          </Select>
        </StatsLabelField>

        {showPersonSearch ? (
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
        ) : null}

        {showProjectSearch ? (
          <StatsLabelField label="项目" className="lg:min-w-[min(100%,18rem)]">
            <Input
              aria-label="项目模糊"
              size="sm"
              variant="bordered"
              className="w-full min-w-[12rem] max-w-[18rem]"
              value={projectKeyword}
              onValueChange={setProjectKeyword}
              placeholder="名称模糊"
            />
          </StatsLabelField>
        ) : null}

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

        <div className="flex w-full justify-end lg:ml-auto lg:w-auto">
          <Button
            color="primary"
            size="sm"
            className="font-medium"
            isLoading={loading}
            startContent={<Icon icon="lucide:search" className="size-4" aria-hidden />}
            onPress={apply}
          >
            查询
          </Button>
        </div>
      </div>
    </div>
  )
}
