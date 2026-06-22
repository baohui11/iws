import { AttendanceDataTabs } from '@/components/stats/stats-attendance-audit-shell'
import { getAttendanceStatsPageData } from '@/lib/stats/stats-page-data'

export default async function AttendanceStatsPage() {
  const { departmentOptions, initialDepartmentId, initialYearMonth } =
    await getAttendanceStatsPageData()

  return (
    <AttendanceDataTabs
      departmentOptions={departmentOptions}
      initialDepartmentId={initialDepartmentId}
      initialYearMonth={initialYearMonth}
    />
  )
}
