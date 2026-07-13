'use client'

import { useEffect, useState } from 'react'
import {
  StatsDepartmentSelect,
  StatsFilterBar,
  StatsProjectStageSelect,
  StatsTextFilter,
  StatsWeekSelect,
  useDebouncedValue,
} from '@/modules/stats/components/shared/stats-filter-controls'
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
}: {
  departmentOptions: DeptOption[]
  weekOptions: WeekOptionLite[]
  initialDepartmentId: string
  initialWeekCode: string
  showPersonSearch: boolean
  showProjectSearch: boolean
  onApply: (s: WeeklyStatsFiltersState) => void
}) {
  const [departmentId, setDepartmentId] = useState(initialDepartmentId)
  const [weekCode, setWeekCode] = useState(initialWeekCode)
  const [personKeyword, setPersonKeyword] = useState('')
  const [projectKeyword, setProjectKeyword] = useState('')
  const [projectStage, setProjectStage] = useState('')

  const debouncedPersonKeyword = useDebouncedValue(personKeyword)
  const debouncedProjectKeyword = useDebouncedValue(projectKeyword)

  useEffect(() => {
    if (!departmentId || !weekCode) return
    onApply({
      departmentId,
      weekCode,
      personKeyword: debouncedPersonKeyword.trim(),
      projectKeyword: debouncedProjectKeyword.trim(),
      projectStage,
    })
  }, [
    debouncedPersonKeyword,
    debouncedProjectKeyword,
    departmentId,
    onApply,
    projectStage,
    weekCode,
  ])

  return (
    <StatsFilterBar>
      <StatsDepartmentSelect
        value={departmentId}
        onChange={setDepartmentId}
        departmentOptions={departmentOptions}
        includeAll={departmentOptions.length > 1}
      />

      <StatsWeekSelect value={weekCode} onChange={setWeekCode} weekOptions={weekOptions} />

      {showPersonSearch ? (
        <StatsTextFilter label="姓名" value={personKeyword} onChange={setPersonKeyword} />
      ) : null}

      {showProjectSearch ? (
        <StatsTextFilter
          label="项目"
          value={projectKeyword}
          onChange={setProjectKeyword}
          placeholder="名称模糊"
        />
      ) : null}

      <StatsProjectStageSelect value={projectStage} onChange={setProjectStage} />
    </StatsFilterBar>
  )
}
