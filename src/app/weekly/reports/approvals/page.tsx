import { Suspense } from 'react'
import { notFound } from 'next/navigation'

import MyApprovalsList from '@/components/weekly/my-approvals-list'
import SubpageHeader from '@/components/common/subpage-header'
import { WEEKLY_REPORTS_PAGE_SIZE } from '@/constants/weekly-reports-list'
import { getSessionProfile } from '@/lib/db/auth/profile'
import {
  getPmApprovalList,
  getPmProjectsForFilter,
  getWeekOptionsUpToCurrent,
  isPmOnAnyProject,
} from '@/lib/db/weekly/reports'
import {
  parseWeeklyApprovalsSearchParams,
  resolveEffectiveWeekCodes,
} from '@/lib/utils/weekly-reports-url'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function WeeklyReportApprovalsPage({
  searchParams,
}: PageProps) {
  const profile = await getSessionProfile()
  const allowed = await isPmOnAnyProject(profile.id)
  if (!allowed) {
    notFound()
  }

  const sp = await searchParams
  const parsed = parseWeeklyApprovalsSearchParams(sp)

  const weekOptions = await getWeekOptionsUpToCurrent(104)
  const effectiveWeeks = resolveEffectiveWeekCodes(
    weekOptions,
    parsed.hasWeeksInUrl,
    parsed.weeks
  )

  const urlState = {
    approval: parsed.approval,
    weeks: effectiveWeeks,
    projects: parsed.projects,
    hasWeeksInUrl: parsed.hasWeeksInUrl,
  }

  const [pmProjects, approvalPaged] = await Promise.all([
    getPmProjectsForFilter(profile.id),
    getPmApprovalList({
      userId: profile.id,
      approvalFilter: parsed.approval,
      weekCodes: effectiveWeeks,
      projectIds: parsed.projects,
      offset: 0,
      limit: WEEKLY_REPORTS_PAGE_SIZE,
    }),
  ])

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <SubpageHeader showBack title="我的审批" />

      <div className="rounded-2xl border border-default-200/80 bg-content1 p-5 shadow-sm md:p-6">
        <Suspense fallback={<p className="text-sm text-default-500">加载中…</p>}>
          <MyApprovalsList
            initialRows={approvalPaged.rows}
            initialTotal={approvalPaged.total}
            pageSize={WEEKLY_REPORTS_PAGE_SIZE}
            weekOptions={weekOptions}
            pmProjects={pmProjects}
            initialUrlState={urlState}
          />
        </Suspense>
      </div>
    </div>
  )
}
