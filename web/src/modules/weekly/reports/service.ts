import { requireUser } from '@/core/auth'
import {
  getMyFilledReportsWithStats,
  getPmApprovalList,
  getPmProjectsForFilter,
  getMemberProjectsForWeeklyFilter,
  getWeekOptionsUpToCurrent,
  isPmOnAnyProject,
  getPmPendingApprovalCount,
} from './repo'
import type { ApprovalDoneFilter } from '../types'

export async function loadMyFilledReports(input: {
  weekCodes: string[]
  projectIds: string[]
  offset?: number
  limit?: number
}) {
  const user = await requireUser()
  return getMyFilledReportsWithStats({
    userId: user.id,
    weekCodes: input.weekCodes,
    projectIds: input.projectIds,
    offset: input.offset,
    limit: input.limit,
  })
}

export async function loadPmApprovalList(input: {
  approvalFilter: ApprovalDoneFilter
  weekCodes: string[]
  projectIds: string[]
  offset?: number
  limit?: number
}) {
  const user = await requireUser()
  return getPmApprovalList({
    userId: user.id,
    approvalFilter: input.approvalFilter,
    weekCodes: input.weekCodes,
    projectIds: input.projectIds,
    offset: input.offset,
    limit: input.limit,
  })
}

export async function listWeekOptions(limit?: number) {
  await requireUser()
  return getWeekOptionsUpToCurrent(limit)
}

export async function listMemberProjectsForFilter() {
  const user = await requireUser()
  return getMemberProjectsForWeeklyFilter(user.id)
}

export async function listPmProjectsForFilter() {
  const user = await requireUser()
  return getPmProjectsForFilter(user.id)
}

export async function checkIsPmOnAnyProject() {
  const user = await requireUser()
  return isPmOnAnyProject(user.id)
}

export async function getPendingApprovalCount() {
  const user = await requireUser()
  return getPmPendingApprovalCount(user.id)
}
