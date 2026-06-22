'use client'

import { Tab, Tabs } from '@heroui/react'
import AttendanceDetailsClient from '@/components/stats/attendance-details-client'
import AttendanceProjectSummaryClient from '@/components/stats/attendance-project-summary-client'
import AttendanceSummaryClient from '@/components/stats/attendance-summary-client'
import FileDownloadAuditClient from '@/components/stats/file-download-audit-client'
import type { DeptOption } from '@/components/stats/weekly-stats-filters'

export function AttendanceDataTabs({
  departmentOptions,
  initialDepartmentId,
  initialYearMonth,
}: {
  departmentOptions: DeptOption[]
  initialDepartmentId: string
  initialYearMonth: string
}) {
  return (
    <div className="p-4 md:p-6">
      <h1 className="mb-4 text-xl font-semibold tracking-tight">考勤数据</h1>
      <div className="flex w-full flex-col">
        <Tabs aria-label="考勤数据">
          <Tab key="summary" title="考勤汇总">
            <AttendanceSummaryClient
              departmentOptions={departmentOptions}
              initialDepartmentId={initialDepartmentId}
              initialYearMonth={initialYearMonth}
            />
          </Tab>
          <Tab key="by-project" title="项目汇总">
            <AttendanceProjectSummaryClient
              departmentOptions={departmentOptions}
              initialDepartmentId={initialDepartmentId}
              initialYearMonth={initialYearMonth}
            />
          </Tab>
          <Tab key="details" title="考勤明细">
            <AttendanceDetailsClient
              departmentOptions={departmentOptions}
              initialDepartmentId={initialDepartmentId}
              initialYearMonth={initialYearMonth}
            />
          </Tab>
        </Tabs>
      </div>
    </div>
  )
}

export function AuditDataTabs() {
  return (
    <div className="p-4 md:p-6">
      <h1 className="mb-4 text-xl font-semibold tracking-tight">下载统计</h1>
      <div className="flex w-full flex-col">
        <FileDownloadAuditClient />
      </div>
    </div>
  )
}
