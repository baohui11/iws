import { notFound } from 'next/navigation'

import ProjectWeekDetailView from '@/modules/weekly/components/project-weekly/project-week-detail-view'
import { requireUser } from '@/core/auth'
import { getProjectWeekWorkItemsPage } from '@/modules/weekly/project-weekly/repo'
import { canAccessWeeklyProject } from '@/modules/weekly/projects/repo'

type PageProps = {
  params: Promise<{ id: string; weekCode: string }>
}

export default async function ProjectWeekDetailPage({ params }: PageProps) {
  const { id, weekCode: rawWeek } = await params
  const weekCode = decodeURIComponent(rawWeek)

  const user = await requireUser()

  const allowed = await canAccessWeeklyProject(
    {
      userId: user.id,
      role: user.role,
      userDepartmentId: user.departmentId,
    },
    id
  )
  if (!allowed) {
    notFound()
  }

  const data = await getProjectWeekWorkItemsPage(id, weekCode)
  if (!data) {
    notFound()
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <ProjectWeekDetailView projectId={id} data={data} />
    </div>
  )
}
