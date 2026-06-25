import { AttendanceDataTabs } from '@/modules/stats/components/attendance/stats-attendance-audit-shell'
import { getAttendanceStatsPageData } from '@/modules/stats/service'

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
