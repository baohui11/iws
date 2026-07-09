'use server'

import { revalidatePath } from 'next/cache'
import { run } from '@/core/result'
import * as svc from './service'
import type { WeeklyMyProjectsParams } from './repo'

export async function loadMyWeeklyProjectsAction(
  params: Omit<
    WeeklyMyProjectsParams,
    'userId' | 'role' | 'userDepartmentId'
  >
) {
  return run(() => svc.listMyProjects(params))
}

export async function loadWeeklyProjectDetailAction(projectId: string) {
  return run(() => svc.getProjectDetail(projectId))
}

export async function loadWeeklyProjectSummaryAction(projectId: string) {
  return run(() => svc.getProjectSummary(projectId))
}

export async function loadWeeklyProjectManageContextAction(projectId: string) {
  return run(() => svc.getProjectManageContext(projectId))
}

export async function searchAddableWeeklyProjectsAction(input: {
  keyword?: string | null
  limit?: number
}) {
  return run(() => svc.searchAddableProjects(input))
}

export async function activateMyWeeklyProjectAction(input: { projectId: string }) {
  return run(() => svc.activateMyProject(input))
}

export async function updateWeeklyProjectMemberActiveAction(input: {
  projectId: string
  memberId: string
  isActive: boolean
}) {
  const result = await run(() => svc.updateProjectMemberActive(input))
  if (result.success) {
    revalidatePath(`/weekly/projects/${input.projectId}`)
    revalidatePath(`/weekly/projects/${input.projectId}/info`)
  }
  return result
}

export async function createWeeklyProjectPauseAction(input: {
  projectId: string
  startWeekCode: string
  endWeekCode?: string | null
  reason?: string | null
}) {
  const result = await run(() => svc.createProjectPause(input))
  if (result.success) {
    revalidatePath('/weekly')
    revalidatePath(`/weekly/projects/${input.projectId}`)
    revalidatePath(`/weekly/projects/${input.projectId}/info`)
  }
  return result
}

export async function deleteWeeklyProjectPauseAction(input: {
  projectId: string
  pauseId: string
}) {
  const result = await run(() => svc.deleteProjectPause(input))
  if (result.success) {
    revalidatePath('/weekly')
    revalidatePath(`/weekly/projects/${input.projectId}`)
    revalidatePath(`/weekly/projects/${input.projectId}/info`)
  }
  return result
}
