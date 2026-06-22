import SubpageHeader from '@/components/common/subpage-header'
import { ProjectDetailProvider } from '@/components/weekly/project-detail-context'
import { ProjectTabsShell } from '@/components/weekly/project-tabs-shell'
import {
  canAccessWeeklyProject,
  getWeeklyProjectDetailById,
} from '@/lib/db/weekly/projects'
import { getProjectWeeklyWeeksPage } from '@/lib/db/weekly/project-weekly-tab'
import { WEEKLY_PROJECT_WEEKS_PAGE_SIZE } from '@/constants/weekly-reports-list'
import { getProfileById } from '@/lib/db/auth/profile'
import { createClient } from '@/lib/supabase/server'
import {
  flattenDepartmentTree,
  formatDepartmentPathLabel,
} from '@/lib/utils/department-display'
import { getDepartmentTree } from '@/lib/db/admin/departments'
import { notFound } from 'next/navigation'

type LayoutProps = {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

export default async function WeeklyProjectDetailLayout({
  children,
  params,
}: LayoutProps) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const profile = user ? await getProfileById(user.id) : null
  if (!profile) {
    notFound()
  }

  const ctx = {
    userId: profile.id,
    role: profile.role,
    userDepartmentId: profile.department_id,
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
