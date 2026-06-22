'use client'

import { Tab, Tabs } from '@heroui/react'
import WeeklyStatsByPersonClient from '@/components/stats/weekly-stats-by-person-client'
import WeeklyStatsByProjectClient from '@/components/stats/weekly-stats-by-project-client'
import WeeklyStatsDetailsClient from '@/components/stats/weekly-stats-details-client'
import type { DeptOption, WeekOptionLite } from '@/components/stats/weekly-stats-filters'

export default function WeeklyStatsTabsClient({
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
  return (
    <div className="flex w-full flex-col">
      <Tabs aria-label="周报统计">
        <Tab key="person" title="按人员">
          <WeeklyStatsByPersonClient
            embedded
            departmentOptions={departmentOptions}
            weekOptions={weekOptions}
            initialDepartmentId={initialDepartmentId}
            initialWeekCode={initialWeekCode}
          />
        </Tab>
        <Tab key="project" title="按项目">
          <WeeklyStatsByProjectClient
            embedded
            departmentOptions={departmentOptions}
            weekOptions={weekOptions}
            initialDepartmentId={initialDepartmentId}
            initialWeekCode={initialWeekCode}
          />
        </Tab>
        <Tab key="details" title="周报明细">
          <WeeklyStatsDetailsClient
            embedded
            departmentOptions={departmentOptions}
            weekOptions={weekOptions}
            initialDepartmentId={initialDepartmentId}
            initialWeekCode={initialWeekCode}
          />
        </Tab>
      </Tabs>
    </div>
  )
}
