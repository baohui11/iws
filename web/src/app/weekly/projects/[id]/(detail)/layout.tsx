import { notFound } from 'next/navigation'

import PageShell from '@/components/common/page-shell'
import SubpageHeader from '@/components/common/subpage-header'
import { ProjectDetailProvider } from '@/modules/weekly/components/projects/project-detail-context'
import { ProjectStageShell } from '@/modules/weekly/components/projects/project-stage-shell'
import { WEEKLY_PROJECT_WEEKS_PAGE_SIZE } from '@/constants/weekly-reports-list'
import {
  PROJECT_STAGE_IMPLEMENTATION,
  PROJECT_STAGE_SALES,
  parseProjectStage,
  type ProjectStageValue,
} from '@/constants/project-stage'
import { requireUser } from '@/core/auth'
import {
  flattenDepartmentTree,
  formatDepartmentPathLabel,
} from '@/modules/org/departments/display'
import { getDepartmentTree } from '@/modules/org/departments/repo'
import { getProjectWeeklyWeeksPage } from '@/modules/weekly/project-weekly/repo'
import {
  canManageWeeklyProjectSettings,
  canAccessWeeklyProject,
  getWeeklyProjectDetailById,
  listWeeklyProjectPauses,
} from '@/modules/weekly/projects/repo'

type LayoutProps = {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

function getProjectAvailableStages(
  projectStage: string | null
): ProjectStageValue[] {
  if (projectStage === PROJECT_STAGE_SALES) return [PROJECT_STAGE_SALES]
  return [PROJECT_STAGE_SALES, PROJECT_STAGE_IMPLEMENTATION]
}

function getVisibleStages(input: {
  projectStage: string | null
  members: { user_id: string | null; project_stage: string | null; is_active: boolean }[]
  userId: string
  role: string | null
}): ProjectStageValue[] {
  const available = getProjectAvailableStages(input.projectStage)
  if (input.role !== 'user') return available

  const memberStages = new Set<ProjectStageValue>()
  for (const member of input.members) {
    if (member.user_id !== input.userId || !member.is_active) continue
    const stage = parseProjectStage(member.project_stage)
    if (stage && available.includes(stage)) memberStages.add(stage)
  }

  return memberStages.size ? [...memberStages] : available
}

export default async function WeeklyProjectDetailLayout({
  children,
  params,
}: LayoutProps) {
  const { id } = await params
  const user = await requireUser()

  const ctx = {
    userId: user.id,
    role: user.role,
    userDepartmentId: user.departmentId,
  }

  const allowed = await canAccessWeeklyProject(ctx, id)
  if (!allowed) {
    notFound()
  }

  const [project, departments, initialProjectWeekly, canManageProject, pauses] = await Promise.all([
    getWeeklyProjectDetailById(id),
    getDepartmentTree(),
    getProjectWeeklyWeeksPage(id, 0, WEEKLY_PROJECT_WEEKS_PAGE_SIZE),
    canManageWeeklyProjectSettings(user.id, id),
    listWeeklyProjectPauses(id),
  ])

  if (!project) {
    notFound()
  }

  const flat = flattenDepartmentTree(departments)
  const departmentLabel = formatDepartmentPathLabel(
    project.department_id,
    flat,
    project.department_name
  )
  const visibleStages = getVisibleStages({
    projectStage: project.project_stage,
    members: project.members,
    userId: user.id,
    role: user.role,
  })

  return (
    <PageShell width="lg">
      <SubpageHeader
        showBack
        title={project.project_name ?? project.project_no ?? '项目详情'}
      />

      <div className="rounded-large border border-divider bg-content1 p-6 shadow-small">
        <ProjectDetailProvider
          value={{
            project,
            departmentLabel,
            initialProjectWeekly,
            canManageProject,
            pauses,
            visibleStages,
          }}
        >
          <ProjectStageShell projectId={id}>{children}</ProjectStageShell>
        </ProjectDetailProvider>
      </div>
    </PageShell>
  )
}
