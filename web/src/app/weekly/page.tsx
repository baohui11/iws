import Link from 'next/link'
import type { ReactNode } from 'react'
import PageShell from '@/components/common/page-shell'
import SubpageHeader from '@/components/common/subpage-header'
import { requireUser } from '@/core/auth'
import {
  getMyFilledReportsWithStats,
  getPmPendingApprovalCount,
  getRecentDashboardProjects,
  getSubmittedWorkDaysForWeek,
  getWeekOptionsUpToCurrent,
  isPmOnAnyProject,
} from '@/modules/weekly/reports/repo'
import RecentReportsList from '@/modules/weekly/components/reports/recent-reports-list'
import {
  PROJECT_STAGE_LABEL,
  type ProjectStageValue,
} from '@/constants/project-stage'
import { WEEKLY_REPORT_STATUS_LABEL } from '@/constants/weekly-report-status'

function buildNewReportPickerHref(input?: {
  projectId?: string
  projectStage?: ProjectStageValue | null
  weekCode?: string
}) {
  const params = new URLSearchParams()
  if (input?.projectId && input.weekCode && input.projectStage) {
    params.set('pick', '1')
    params.set('projectId', input.projectId)
    params.set('weekCode', input.weekCode)
    params.set('projectStage', input.projectStage)
  }
  const qs = params.toString()
  return qs ? `/weekly/reports/new?${qs}` : '/weekly/reports/new'
}

function buildUploadHref(input?: {
  projectId?: string
  projectStage?: ProjectStageValue | null
}) {
  const params = new URLSearchParams()
  if (input?.projectId && input.projectStage) {
    params.set('projectId', input.projectId)
    params.set('projectStage', input.projectStage)
  }
  const qs = params.toString()
  return qs ? `/weekly/files/upload?${qs}` : '/weekly/files/upload'
}

function ActionLink({
  href,
  children,
  primary = false,
}: {
  href: string
  children: ReactNode
  primary?: boolean
}) {
  return (
    <Link
      href={href}
      className={
        primary
          ? 'inline-flex h-9 items-center justify-center rounded-medium bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90'
          : 'inline-flex h-9 items-center justify-center rounded-medium bg-default-100 px-3 text-sm font-medium text-foreground transition-colors hover:bg-default-200'
      }
    >
      {children}
    </Link>
  )
}

export default async function WeeklyDashboardPage() {
  const user = await requireUser()
  const weekOptions = await getWeekOptionsUpToCurrent(8)
  const currentWeek = weekOptions.find((week) => week.is_current) ?? weekOptions[0]
  const currentWeekCode = currentWeek?.week_code ?? ''
  const recentWeekCodes = weekOptions.slice(0, 2).map((week) => week.week_code)

  const [
    submittedDays,
    pendingApprovalCount,
    showPmApproval,
    recentProjects,
    recentReports,
  ] = await Promise.all([
    currentWeekCode
      ? getSubmittedWorkDaysForWeek(user.id, currentWeekCode)
      : Promise.resolve(0),
    getPmPendingApprovalCount(user.id),
    isPmOnAnyProject(user.id),
    getRecentDashboardProjects({
      userId: user.id,
      weekCodes: recentWeekCodes,
      limit: 4,
    }),
    getMyFilledReportsWithStats({
      userId: user.id,
      weekCodes: weekOptions.map((week) => week.week_code),
      projectIds: [],
      offset: 0,
      limit: 5,
    }),
  ])

  return (
    <PageShell>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <SubpageHeader title="项目周报" className="mb-0" />
        <div className="flex flex-wrap gap-2">
          <ActionLink href={buildNewReportPickerHref()} primary>
            新增周报
          </ActionLink>
          <ActionLink href={buildUploadHref()}>上传文件</ActionLink>
          <ActionLink href="/weekly/projects/add">添加项目</ActionLink>
          {showPmApproval ? (
            <ActionLink href="/weekly/reports/approvals">
              待我审批
              {pendingApprovalCount > 0 ? ` ${pendingApprovalCount}` : ''}
            </ActionLink>
          ) : null}
        </div>
      </div>

      <section className="rounded-2xl border border-default-200/80 bg-content1 p-5 shadow-sm md:p-6">
        {currentWeek ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm text-default-500">当前周</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                {currentWeek.title_zh}
              </h2>
              <p className="mt-1 text-sm text-default-500">
                {currentWeek.range_line}
              </p>
            </div>
            <div className="rounded-xl bg-default-50 px-4 py-3 text-right">
              <p className="text-xs text-default-500">本周已提交</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {submittedDays}
                <span className="ml-1 text-sm font-normal text-default-500">天</span>
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-default-500">暂无周次数据</p>
        )}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-2xl border border-default-200/80 bg-content1 p-5 shadow-sm md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">
              最近参与项目
            </h2>
            <Link
              href="/weekly/projects"
              className="text-sm font-medium text-primary hover:underline"
            >
              查看全部
            </Link>
          </div>
          {recentProjects.length === 0 ? (
            <p className="rounded-xl border border-dashed border-default-200 py-10 text-center text-sm text-default-500">
              最近两周暂无填报项目
            </p>
          ) : (
            <div className="divide-y divide-default-100">
              {recentProjects.map((project) => (
                <div
                  key={project.project_id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {project.project_name ?? '-'}
                    </p>
                    <p className="mt-1 text-xs text-default-500">
                      {project.stages
                        .map((stage) => PROJECT_STAGE_LABEL[stage])
                        .join(' / ')}
                      {' · 最近 '}
                      {project.latest_week_code}
                      {' · '}
                      {WEEKLY_REPORT_STATUS_LABEL[project.latest_status]}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {project.can_create_report && currentWeekCode ? (
                      <ActionLink
                        href={buildNewReportPickerHref({
                          projectId: project.project_id,
                          projectStage: project.action_stage,
                          weekCode: currentWeekCode,
                        })}
                      >
                        新增周报
                      </ActionLink>
                    ) : null}
                    {project.can_upload_file ? (
                      <ActionLink
                        href={buildUploadHref({
                          projectId: project.project_id,
                          projectStage: project.action_stage,
                        })}
                      >
                        上传文件
                      </ActionLink>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-default-200/80 bg-content1 p-5 shadow-sm md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">
              最近填写周报
            </h2>
            <Link
              href="/weekly/reports"
              className="text-sm font-medium text-primary hover:underline"
            >
              查看全部
            </Link>
          </div>
          <RecentReportsList initialRows={recentReports.rows} />
        </section>
      </div>
    </PageShell>
  )
}
