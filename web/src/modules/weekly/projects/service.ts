import { requireUser } from '@/core/auth'
import { NotFoundError } from '@/core/errors'
import {
  canAccessWeeklyProject,
  getMyWeeklyProjectsList,
  getWeeklyProjectDetailById,
  getWeeklyProjectSummaryById,
  type WeeklyMyProjectsParams,
} from './repo'

export async function listMyProjects(
  params: Omit<
    WeeklyMyProjectsParams,
    'userId' | 'role' | 'userDepartmentId'
  >
) {
  const user = await requireUser()
  return getMyWeeklyProjectsList({
    ...params,
    userId: user.id,
    role: user.role,
    userDepartmentId: user.departmentId,
  })
}

export async function getProjectDetail(projectId: string) {
  const user = await requireUser()
  const ok = await canAccessWeeklyProject(
    {
      userId: user.id,
      role: user.role,
      userDepartmentId: user.departmentId,
    },
    projectId
  )
  if (!ok) throw new NotFoundError('项目不存在或无权访问')
  const detail = await getWeeklyProjectDetailById(projectId)
  if (!detail) throw new NotFoundError('项目不存在')
  return detail
}

export async function getProjectSummary(projectId: string) {
  const user = await requireUser()
  const ok = await canAccessWeeklyProject(
    {
      userId: user.id,
      role: user.role,
      userDepartmentId: user.departmentId,
    },
    projectId
  )
  if (!ok) throw new NotFoundError('项目不存在或无权访问')
  const summary = await getWeeklyProjectSummaryById(projectId)
  if (!summary) throw new NotFoundError('项目不存在')
  return summary
}

export async function assertProjectAccess(projectId: string) {
  const user = await requireUser()
  const ok = await canAccessWeeklyProject(
    {
      userId: user.id,
      role: user.role,
      userDepartmentId: user.departmentId,
    },
    projectId
  )
  if (!ok) throw new NotFoundError('项目不存在或无权访问')
}
