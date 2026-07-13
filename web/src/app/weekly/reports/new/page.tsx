import { notFound, redirect } from 'next/navigation'

import PageShell from '@/components/common/page-shell'
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
import {
  PROJECT_STAGE_IMPLEMENTATION,
  PROJECT_STAGE_SALES,
  parseProjectStage,
  type ProjectStageValue,
} from '@/constants/project-stage'

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
  const projectStageParam =
    typeof sp.projectStage === 'string' ? parseProjectStage(sp.projectStage) : null
  const stayInPicker = sp.pick === '1'
  const linkedFileId =
    typeof sp.linkedFileId === 'string' ? sp.linkedFileId : undefined
  const linkedFileName =
    typeof sp.linkedFileName === 'string' ? sp.linkedFileName : undefined
  const linkTargetKey =
    typeof sp.linkTargetKey === 'string' ? sp.linkTargetKey : undefined

  const selectedProject = projectId
    ? projects.find((p) => p.id === projectId)
    : null
  const defaultStage = selectedProject?.project_stage ?? PROJECT_STAGE_IMPLEMENTATION
  const memberStages = selectedProject?.available_project_stages ?? []
  const stageOptions: ProjectStageValue[] = memberStages.length
    ? memberStages
    : defaultStage === PROJECT_STAGE_SALES
      ? [PROJECT_STAGE_SALES]
      : [PROJECT_STAGE_IMPLEMENTATION, PROJECT_STAGE_SALES]
  const projectStage = projectStageParam && stageOptions.includes(projectStageParam)
    ? projectStageParam
    : stageOptions[0]

  if (projectId && weekCode && selectedProject && !stayInPicker) {
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
      weekCode,
      projectStage
    )
    if (meta && !isWeeklyReportEditableStatus(meta.status)) {
      redirect(`/weekly/reports/${meta.id}`)
    }

    const payload = await loadWeeklyReportEditorPayload(
      user.id,
      projectId,
      weekCode,
      projectStage
    )
    if (!payload) notFound()

    const returnToHref = `/weekly/reports/new?projectId=${encodeURIComponent(projectId)}&weekCode=${encodeURIComponent(weekCode)}&projectStage=${encodeURIComponent(projectStage)}`

    return (
      <PageShell width="sm">
        <WeeklyReportFillForm
          initialPayload={payload}
          returnToHref={returnToHref}
          initialLinkedFile={
            linkedFileId && linkedFileName && linkTargetKey
              ? {
                  id: linkedFileId,
                  file_name: linkedFileName,
                  target_key: linkTargetKey,
                }
              : null
          }
        />
      </PageShell>
    )
  }

  return (
    <PageShell>
      <SubpageHeader showBack title="新建周报" />
      {projects.length === 0 ? (
        <p className="rounded-xl border border-dashed border-default-200 py-12 text-center text-sm text-default-500">
          暂无可填写周报的项目，请联系管理员分配项目成员。
        </p>
      ) : (
        <WeeklyReportScopePicker
          projects={projects}
          weekOptions={weekOptions}
          initialProjectId={selectedProject?.id}
          initialWeekCode={weekCode}
          initialProjectStage={projectStage}
        />
      )}
    </PageShell>
  )
}
