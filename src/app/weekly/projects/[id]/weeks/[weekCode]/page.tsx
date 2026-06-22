import { notFound } from 'next/navigation'

import ProjectWeekDetailView from '@/components/weekly/project-week-detail-view'
import { getProfileById } from '@/lib/db/auth/profile'
import { canAccessWeeklyProject } from '@/lib/db/weekly/projects'
import { getProjectWeekWorkItemsPage } from '@/lib/db/weekly/project-weekly-tab'
import { createClient } from '@/lib/supabase/server'

type PageProps = {
  params: Promise<{ id: string; weekCode: string }>
}

export default async function ProjectWeekDetailPage({ params }: PageProps) {
  const { id, weekCode: rawWeek } = await params

  const weekCode = decodeURIComponent(rawWeek)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const profile = user ? await getProfileById(user.id) : null
  if (!profile) {
    notFound()
  }

  const allowed = await canAccessWeeklyProject(
    {
      userId: profile.id,
      role: profile.role,
      userDepartmentId: profile.department_id,
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
