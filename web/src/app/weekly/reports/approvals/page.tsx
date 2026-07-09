import { Suspense } from 'react'
import { notFound } from 'next/navigation'

import SubpageHeader from '@/components/common/subpage-header'
import MyApprovalsList from '@/modules/weekly/components/reports/my-approvals-list'
import { WEEKLY_REPORTS_PAGE_SIZE } from '@/constants/weekly-reports-list'
import { requireUser } from '@/core/auth'
import {
  getPmApprovalList,
  getPmProjectsForFilter,
  getWeekOptionsUpToCurrent,
  isPmOnAnyProject,
} from '@/modules/weekly/reports/repo'
import {
  getDefaultApprovalWeekRange,
  resolveApprovalWeekCodes,
} from '@/modules/weekly/lib/weekly-reports-url'

export default async function WeeklyReportApprovalsPage() {
  const user = await requireUser()
  const allowed = await isPmOnAnyProject(user.id)
  if (!allowed) {
    notFound()
  }

  const weekOptions = await getWeekOptionsUpToCurrent(104)
  const defaults = getDefaultApprovalWeekRange(weekOptions)
  const effectiveWeeks = resolveApprovalWeekCodes(weekOptions, {
    weekFrom: defaults.weekFrom,
    weekTo: defaults.weekTo,
    hasWeekRangeInUrl: true,
  })

  const [pmProjects, approvalPaged] = await Promise.all([
    getPmProjectsForFilter(user.id),
    getPmApprovalList({
      userId: user.id,
      approvalFilter: 'all',
      weekCodes: effectiveWeeks,
      projectIds: [],
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
            initialWeekFrom={defaults.weekFrom}
            initialWeekTo={defaults.weekTo}
          />
        </Suspense>
      </div>
    </div>
  )
}
