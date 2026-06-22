import { notFound, redirect } from 'next/navigation'

import WeeklyReportReviewClient from '@/components/weekly/weekly-report-review-client'
import { getSessionProfile } from '@/lib/db/auth/profile'
import {
  getWeeklyReportApprovalByApprover,
  loadWeeklyReportDetail,
} from '@/lib/db/weekly/report-editor'
import { getPmProjectIdsForUser } from '@/lib/db/weekly/reports'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function WeeklyReportReviewPage({ params }: PageProps) {
  const { id } = await params
  const profile = await getSessionProfile()
  const detail = await loadWeeklyReportDetail(id)
  if (!detail) notFound()

  if (detail.report.status === 'draft') {
    notFound()
  }

  if (detail.report.user_id === profile.id) {
    redirect(`/weekly/reports/${id}`)
  }

  const pmIds = await getPmProjectIdsForUser(profile.id)
  if (!pmIds.includes(detail.report.project_id)) {
    notFound()
  }

  const myApproval = await getWeeklyReportApprovalByApprover(
    id,
    profile.id,
    detail.report.submit_time
  )
  const canApprove = detail.report.status === 'pending' && myApproval == null

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      {/* <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">周报审批</h1>
        <p className="mt-1 text-sm text-foreground/50">
          查看内容后选择通过或驳回
        </p>
      </div> */}
      <WeeklyReportReviewClient
        detail={detail}
        viewerId={profile.id}
        myApproval={myApproval}
        canApprove={canApprove}
      />
    </div>
  )
}
