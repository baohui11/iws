import SubpageHeader from '@/components/common/subpage-header'
import MyAttendanceDetailsClient from '@/modules/weekly/components/attendance/my-attendance-details-client'
import { requireUser } from '@/core/auth'
import { getYearMonthOfCurrentWeek } from '@/modules/stats/lib/stats-year-month'

export default async function WeeklyAttendancePage() {
  await requireUser()
  const initialYearMonth = getYearMonthOfCurrentWeek()

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <SubpageHeader title="我的考勤" />

      <div className="rounded-2xl border border-default-200/80 bg-content1 p-5 shadow-sm md:p-6">
        <MyAttendanceDetailsClient initialYearMonth={initialYearMonth} />
      </div>
    </div>
  )
}
