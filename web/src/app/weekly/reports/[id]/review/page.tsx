import { notFound, redirect } from 'next/navigation'

import WeeklyReportReviewClient from '@/modules/weekly/components/reports/weekly-report-review-client'
import { requireUser } from '@/core/auth'
import {
  getWeeklyReportApprovalByApprover,
  loadWeeklyReportDetail,
} from '@/modules/weekly/report-editor/repo'
import { getPmProjectIdsForUser } from '@/modules/weekly/reports/repo'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function WeeklyReportReviewPage({ params }: PageProps) {
  const { id } = await params
  const user = await requireUser()
  const detail = await loadWeeklyReportDetail(id)
  if (!detail) notFound()

  if (detail.report.status === 'draft') {
    notFound()
  }

  if (detail.report.user_id === user.id) {
    redirect(`/weekly/reports/${id}`)
  }

  const pmIds = await getPmProjectIdsForUser(user.id)
  if (!pmIds.includes(detail.report.project_id)) {
    notFound()
  }

  const myApproval = await getWeeklyReportApprovalByApprover(
    id,
    user.id,
    detail.report.submit_time
  )
  const canApprove = detail.report.status === 'pending' && myApproval == null

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <WeeklyReportReviewClient
        detail={detail}
        viewerId={user.id}
        myApproval={myApproval}
        canApprove={canApprove}
      />
    </div>
  )
}
