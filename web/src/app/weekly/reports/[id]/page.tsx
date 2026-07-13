import { notFound } from 'next/navigation'

import PageShell from '@/components/common/page-shell'
import WeeklyReportDetailView from '@/modules/weekly/components/reports/weekly-report-detail-view'
import { requireUser } from '@/core/auth'
import { loadWeeklyReportDetail } from '@/modules/weekly/report-editor/repo'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function WeeklyReportDetailPage({ params }: PageProps) {
  const { id } = await params
  const user = await requireUser()
  const detail = await loadWeeklyReportDetail(id)
  if (!detail) notFound()

  return (
    <PageShell width="sm">
      <WeeklyReportDetailView detail={detail} viewerId={user.id} />
    </PageShell>
  )
}
