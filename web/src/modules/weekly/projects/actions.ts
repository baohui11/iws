'use server'

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
