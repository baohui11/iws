import WeeklyStatsTabsClient from '@/components/stats/weekly-stats-tabs'
import { getWeeklyStatsPageData } from '@/lib/stats/stats-page-data'

export default async function WeeklyStatsPage() {
  const { departmentOptions, weekOptions, initialDepartmentId, initialWeekCode } =
    await getWeeklyStatsPageData()

  return (
    <div className="p-4 md:p-6">
      <h1 className="mb-4 text-xl font-semibold tracking-tight">周报统计</h1>
      <WeeklyStatsTabsClient
        departmentOptions={departmentOptions}
        weekOptions={weekOptions.map((w) => ({
          week_code: w.week_code,
          title_zh: w.title_zh,
          range_line: w.range_line,
        }))}
        initialDepartmentId={initialDepartmentId}
        initialWeekCode={initialWeekCode}
      />
    </div>
  )
}
