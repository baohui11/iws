import { notFound } from 'next/navigation'

import SubpageHeader from '@/components/common/subpage-header'
import { ProjectDetailProvider } from '@/modules/weekly/components/projects/project-detail-context'
import { ProjectTabsShell } from '@/modules/weekly/components/projects/project-tabs-shell'
import { WEEKLY_PROJECT_WEEKS_PAGE_SIZE } from '@/constants/weekly-reports-list'
import { requireUser } from '@/core/auth'
import {
  flattenDepartmentTree,
  formatDepartmentPathLabel,
} from '@/modules/org/departments/display'
import { getDepartmentTree } from '@/modules/org/departments/repo'
import { getProjectWeeklyWeeksPage } from '@/modules/weekly/project-weekly/repo'
import {
  canAccessWeeklyProject,
  getWeeklyProjectDetailById,
} from '@/modules/weekly/projects/repo'

type LayoutProps = {
  children: React.ReactNode
  params: Promise<{ id: string }>
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

  const [project, departments, initialProjectWeekly] = await Promise.all([
    getWeeklyProjectDetailById(id),
    getDepartmentTree(),
    getProjectWeeklyWeeksPage(id, 0, WEEKLY_PROJECT_WEEKS_PAGE_SIZE),
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

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
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
          }}
        >
          <ProjectTabsShell projectId={id}>{children}</ProjectTabsShell>
        </ProjectDetailProvider>
      </div>
    </div>
  )
}
