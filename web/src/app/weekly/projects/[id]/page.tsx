import { notFound, redirect } from 'next/navigation'
import { requireUser } from '@/core/auth'
import {
  PROJECT_STAGE_SALES,
  parseProjectStage,
} from '@/constants/project-stage'
import {
  canAccessWeeklyProject,
  getWeeklyProjectDetailById,
} from '@/modules/weekly/projects/repo'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** 进入项目详情默认落在阶段工作台。 */
export default async function WeeklyProjectDetailRedirectPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params
  const sp = await searchParams
  const user = await requireUser()
  const allowed = await canAccessWeeklyProject(
    {
      userId: user.id,
      role: user.role,
      userDepartmentId: user.departmentId,
    },
    id
  )
  if (!allowed) notFound()

  const project = await getWeeklyProjectDetailById(id)
  if (!project) notFound()

  const stageParam =
    typeof sp.stage === 'string' ? parseProjectStage(sp.stage) : null
  const stage = stageParam ?? parseProjectStage(project.project_stage)
  if (stage === PROJECT_STAGE_SALES) {
    redirect(`/weekly/projects/${id}/sales`)
  }
  redirect(`/weekly/projects/${id}/delivery`)
}
