import MyAttendanceDetailsClient from '@/components/weekly/my-attendance-details-client'
import { getYearMonthOfCurrentWeek } from '@/lib/utils/stats-year-month'

export default async function WeeklyAttendancePage() {
  const initialYearMonth = getYearMonthOfCurrentWeek()

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-4 text-xl font-semibold tracking-tight">我的考勤</h1>
      <MyAttendanceDetailsClient initialYearMonth={initialYearMonth} />
    </div>
  )
}
