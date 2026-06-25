import MyAttendanceDetailsClient from '@/modules/weekly/components/attendance/my-attendance-details-client'
import { requireUser } from '@/core/auth'
import { getYearMonthOfCurrentWeek } from '@/modules/stats/lib/stats-year-month'

export default async function WeeklyAttendancePage() {
  await requireUser()
  const initialYearMonth = getYearMonthOfCurrentWeek()

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-4 text-xl font-semibold tracking-tight">我的考勤</h1>
      <MyAttendanceDetailsClient initialYearMonth={initialYearMonth} />
    </div>
  )
}
