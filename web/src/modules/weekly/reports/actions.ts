'use server'

import { run } from '@/core/result'
import * as svc from './service'
import type { ApprovalDoneFilter } from '../types'

export async function loadMyFilledReportsAction(input: {
  weekCodes: string[]
  projectIds: string[]
  offset?: number
  limit?: number
}) {
  return run(() => svc.loadMyFilledReports(input))
}

export async function loadPmApprovalListAction(input: {
  approvalFilter: ApprovalDoneFilter
  weekCodes: string[]
  projectIds: string[]
  offset?: number
  limit?: number
}) {
  return run(() => svc.loadPmApprovalList(input))
}

export async function loadWeekOptionsAction(limit?: number) {
  return run(() => svc.listWeekOptions(limit))
}

export async function loadMemberProjectsForFilterAction() {
  return run(() => svc.listMemberProjectsForFilter())
}

export async function loadPmProjectsForFilterAction() {
  return run(() => svc.listPmProjectsForFilter())
}

export async function checkIsPmOnAnyProjectAction() {
  return run(() => svc.checkIsPmOnAnyProject())
}

export async function getPendingApprovalCountAction() {
  return run(() => svc.getPendingApprovalCount())
}
