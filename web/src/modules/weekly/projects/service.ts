import { requireUser } from '@/core/auth'
import { NotFoundError, ValidationError } from '@/core/errors'
import { compareWeekCode, parseWeekCode } from '@/modules/weekly/lib/iso-week'
import {
  activateMemberProjectForWeekly,
  canManageWeeklyProjectSettings,
  canAccessWeeklyProject,
  createWeeklyProjectPause,
  deleteWeeklyProjectPause,
  getMyWeeklyProjectsList,
  getWeeklyProjectDetailById,
  getWeeklyProjectSummaryById,
  listWeeklyProjectPauses,
  searchInactiveMemberProjectsForAdd,
  updateWeeklyProjectMemberActive,
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

export async function getProjectManageContext(projectId: string) {
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
  const [canManage, pauses] = await Promise.all([
    canManageWeeklyProjectSettings(user.id, projectId),
    listWeeklyProjectPauses(projectId),
  ])
  return { can_manage: canManage, pauses }
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

export async function searchAddableProjects(input: {
  keyword?: string | null
  limit?: number
}) {
  const user = await requireUser()
  return searchInactiveMemberProjectsForAdd({
    userId: user.id,
    keyword: input.keyword,
    limit: input.limit,
  })
}

export async function activateMyProject(input: { projectId: string }) {
  const user = await requireUser()
  if (!input.projectId?.trim()) throw new ValidationError('项目不能为空')
  const ok = await activateMemberProjectForWeekly({
    userId: user.id,
    projectId: input.projectId.trim(),
  })
  if (!ok) {
    throw new ValidationError('只能添加自己参与且未生效的项目')
  }
  return { project_id: input.projectId.trim() }
}

async function requireWeeklyProjectManager(projectId: string, userId: string) {
  const ok = await canManageWeeklyProjectSettings(userId, projectId)
  if (!ok) {
    throw new ValidationError('只有项目经理或销售LD可以维护该项目')
  }
}

export async function updateProjectMemberActive(input: {
  projectId: string
  memberId: string
  isActive: boolean
}) {
  const user = await requireUser()
  if (!input.projectId?.trim() || !input.memberId?.trim()) {
    throw new ValidationError('参数不完整')
  }
  await requireWeeklyProjectManager(input.projectId, user.id)
  const ok = await updateWeeklyProjectMemberActive({
    projectId: input.projectId,
    memberId: input.memberId,
    isActive: input.isActive,
  })
  if (!ok) throw new ValidationError('成员不存在')
  return { id: input.memberId, is_active: input.isActive }
}

export async function createProjectPause(input: {
  projectId: string
  startWeekCode: string
  endWeekCode?: string | null
  reason?: string | null
}) {
  const user = await requireUser()
  const start = input.startWeekCode?.trim()
  const end = input.endWeekCode?.trim() || start
  if (!input.projectId?.trim() || !start) {
    throw new ValidationError('请选择暂停周期')
  }
  if (!parseWeekCode(start) || !parseWeekCode(end)) {
    throw new ValidationError('周次格式不正确')
  }
  if (compareWeekCode(start, end) > 0) {
    throw new ValidationError('结束周次不能早于开始周次')
  }
  await requireWeeklyProjectManager(input.projectId, user.id)
  const pause = await createWeeklyProjectPause({
    projectId: input.projectId,
    startWeekCode: start,
    endWeekCode: end,
    reason: input.reason?.trim() || null,
    createdBy: user.id,
  })
  return pause
}

export async function deleteProjectPause(input: {
  projectId: string
  pauseId: string
}) {
  const user = await requireUser()
  if (!input.projectId?.trim() || !input.pauseId?.trim()) {
    throw new ValidationError('参数不完整')
  }
  await requireWeeklyProjectManager(input.projectId, user.id)
  const ok = await deleteWeeklyProjectPause({
    projectId: input.projectId,
    pauseId: input.pauseId,
  })
  if (!ok) throw new ValidationError('暂停记录不存在')
  return { id: input.pauseId }
}
