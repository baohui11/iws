import { notFound, redirect } from 'next/navigation'

import WeeklyReportFillForm from '@/components/weekly/weekly-report-fill-form'
import WeeklyReportScopePicker from '@/components/weekly/weekly-report-scope-picker'
import SubpageHeader from '@/components/common/subpage-header'
import { getSessionProfile } from '@/lib/db/auth/profile'
import {
  getWeeklyReportMetaForUserWeek,
  loadWeeklyReportEditorPayload,
} from '@/lib/db/weekly/report-editor'
import { isProjectWeekExempt } from '@/lib/db/weekly/exemptions'
import {
  getMemberProjectsForWeeklyFilter,
  getWeekOptionsUpToCurrent,
} from '@/lib/db/weekly/reports'
import { formatWeekCodeLabelZh } from '@/lib/utils/iso-week'
import WeeklyNewReportExemptNotice from '@/components/weekly/weekly-new-report-exempt-notice'
import { isWeeklyReportEditableStatus } from '@/constants/weekly-report-status'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function WeeklyNewReportPage({ searchParams }: PageProps) {
  const profile = await getSessionProfile()
  const projects = await getMemberProjectsForWeeklyFilter(profile.id)
  const weekOptions = await getWeekOptionsUpToCurrent(104)

  const sp = await searchParams
  const projectId =
    typeof sp.projectId === 'string' ? sp.projectId : undefined
  const weekCode =
    typeof sp.weekCode === 'string' ? sp.weekCode : undefined

  if (projectId && weekCode) {
    if (await isProjectWeekExempt(projectId, weekCode)) {
      const projectName =
        projects.find((p) => p.id === projectId)?.project_name ?? null
      return (
        <WeeklyNewReportExemptNotice
          projectName={projectName}
          weekLabel={formatWeekCodeLabelZh(weekCode)}
        />
      )
    }

    const meta = await getWeeklyReportMetaForUserWeek(
      profile.id,
      projectId,
      weekCode
    )
    if (meta && !isWeeklyReportEditableStatus(meta.status)) {
      redirect(`/weekly/reports/${meta.id}`)
    }

    const payload = await loadWeeklyReportEditorPayload(
      profile.id,
      projectId,
      weekCode
    )
    if (!payload) notFound()

    const returnToHref = `/weekly/reports/new?projectId=${encodeURIComponent(projectId)}&weekCode=${encodeURIComponent(weekCode)}`

    return (
      <div className="container mx-auto max-w-3xl px-4 py-6 sm:py-8">
        <WeeklyReportFillForm
          initialPayload={payload}
          returnToHref={returnToHref}
        />
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <SubpageHeader showBack title="新建周报" />
      {projects.length === 0 ? (
        <p className="rounded-xl border border-dashed border-default-200 py-12 text-center text-sm text-default-500">
          暂无可填写周报的项目，请联系管理员分配项目成员。
        </p>
      ) : (
        <WeeklyReportScopePicker
          projects={projects}
          weekOptions={weekOptions}
        />
      )}
    </div>
  )
}
