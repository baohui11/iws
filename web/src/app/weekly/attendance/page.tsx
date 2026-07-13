import PageShell from '@/components/common/page-shell'
import SubpageHeader from '@/components/common/subpage-header'
import MyAttendanceDetailsClient from '@/modules/weekly/components/attendance/my-attendance-details-client'
import { requireUser } from '@/core/auth'
import { getYearMonthOfCurrentWeek } from '@/modules/stats/lib/stats-year-month'

export default async function WeeklyAttendancePage() {
  await requireUser()
  const initialYearMonth = getYearMonthOfCurrentWeek()

  return (
    <PageShell>
      <SubpageHeader title="我的考勤" />

      <div className="rounded-2xl border border-default-200/80 bg-content1 p-5 shadow-sm md:p-6">
        <MyAttendanceDetailsClient initialYearMonth={initialYearMonth} />
      </div>
    </PageShell>
  )
}
