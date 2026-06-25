import { Suspense } from 'react'

import SubpageHeader from '@/components/common/subpage-header'
import MyFilledReportsView from '@/modules/weekly/components/reports/my-filled-reports-view'
import WeeklyReportsHeaderActions from '@/modules/weekly/components/reports/weekly-reports-header-actions'
import { WEEKLY_REPORTS_PAGE_SIZE } from '@/constants/weekly-reports-list'
import { requireUser } from '@/core/auth'
import {
  getMemberProjectsForWeeklyFilter,
  getMyFilledReportsWithStats,
  getPmPendingApprovalCount,
  getWeekOptionsUpToCurrent,
  isPmOnAnyProject,
} from '@/modules/weekly/reports/repo'
import {
  deriveProjectIdsFromSelection,
  parseWeeklyFilledSearchParams,
  resolveMyReportsWeekCodes,
} from '@/modules/weekly/lib/weekly-reports-url'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function WeeklyReportsPage({ searchParams }: PageProps) {
  const user = await requireUser()

  const sp = await searchParams
  const parsed = parseWeeklyFilledSearchParams(sp)

  const weekOptions = await getWeekOptionsUpToCurrent(104)
  const effectiveWeeks = resolveMyReportsWeekCodes(weekOptions, parsed)

  const memberProjects = await getMemberProjectsForWeeklyFilter(user.id)
  const projectIds = deriveProjectIdsFromSelection(
    memberProjects,
    parsed.hasProjectsInUrl ? parsed.projects : []
  )

  const urlState = {
    view: parsed.view,
    weekFrom: parsed.weekFrom,
    weekTo: parsed.weekTo,
    hasWeekRangeInUrl: parsed.hasWeekRangeInUrl,
    projects: parsed.projects,
    hasProjectsInUrl: parsed.hasProjectsInUrl,
  }

  const [filledPaged, pendingCount, showPmActions] = await Promise.all([
    getMyFilledReportsWithStats({
      userId: user.id,
      weekCodes: effectiveWeeks,
      projectIds,
      offset: 0,
      limit: WEEKLY_REPORTS_PAGE_SIZE,
    }),
    getPmPendingApprovalCount(user.id),
    isPmOnAnyProject(user.id),
  ])

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <SubpageHeader title="我的周报" className="mb-0" />
        <WeeklyReportsHeaderActions
          pendingCount={pendingCount}
          showPmActions={showPmActions}
        />
      </div>

      <div className="rounded-2xl border border-default-200/80 bg-content1 p-5 shadow-sm md:p-6">
        <Suspense fallback={<p className="text-sm text-default-500">加载中…</p>}>
          <MyFilledReportsView
            initialRows={filledPaged.rows}
            initialTotal={filledPaged.total}
            pageSize={WEEKLY_REPORTS_PAGE_SIZE}
            weekOptions={weekOptions}
            memberProjects={memberProjects}
            initialUrlState={urlState}
          />
        </Suspense>
      </div>
    </div>
  )
}
