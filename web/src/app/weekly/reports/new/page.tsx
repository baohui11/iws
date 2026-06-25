import { notFound, redirect } from 'next/navigation'

import SubpageHeader from '@/components/common/subpage-header'
import WeeklyNewReportExemptNotice from '@/modules/weekly/components/reports/weekly-new-report-exempt-notice'
import WeeklyReportFillForm from '@/modules/weekly/components/reports/weekly-report-fill-form'
import WeeklyReportScopePicker from '@/modules/weekly/components/reports/weekly-report-scope-picker'
import { isWeeklyReportEditableStatus } from '@/constants/weekly-report-status'
import { requireUser } from '@/core/auth'
import { isProjectWeekExempt } from '@/modules/weekly/exemptions/repo'
import {
  getWeeklyReportMetaForUserWeek,
  loadWeeklyReportEditorPayload,
} from '@/modules/weekly/report-editor/repo'
import {
  getMemberProjectsForWeeklyFilter,
  getWeekOptionsUpToCurrent,
} from '@/modules/weekly/reports/repo'
import { formatWeekCodeLabelZh } from '@/modules/weekly/lib/iso-week'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function WeeklyNewReportPage({ searchParams }: PageProps) {
  const user = await requireUser()
  const projects = await getMemberProjectsForWeeklyFilter(user.id)
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
      user.id,
      projectId,
      weekCode
    )
    if (meta && !isWeeklyReportEditableStatus(meta.status)) {
      redirect(`/weekly/reports/${meta.id}`)
    }

    const payload = await loadWeeklyReportEditorPayload(
      user.id,
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
