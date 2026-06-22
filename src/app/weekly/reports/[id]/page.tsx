import { notFound } from 'next/navigation'

import WeeklyReportDetailView from '@/components/weekly/weekly-report-detail-view'
import { getSessionProfile } from '@/lib/db/auth/profile'
import { loadWeeklyReportDetail } from '@/lib/db/weekly/report-editor'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function WeeklyReportDetailPage({ params }: PageProps) {
  const { id } = await params
  const profile = await getSessionProfile()
  const detail = await loadWeeklyReportDetail(id)
  if (!detail) notFound()

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <WeeklyReportDetailView detail={detail} viewerId={profile.id} />
    </div>
  )
}
