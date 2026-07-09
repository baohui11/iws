'use server'

import { run } from '@/core/result'
import * as svc from './service'
import type { WeekHalfSlot } from '@/modules/weekly/lib/weekly-report-work-slots'
import type { ProjectStageValue } from '@/constants/project-stage'

export async function loadWeeklyReportEditorAction(input: {
  projectId: string
  weekCode: string
  projectStage: ProjectStageValue
}) {
  return run(() => svc.loadEditor(input))
}

export async function loadWeeklyReportFilesForPickerAction(input: {
  projectId: string
  weekStartDate: string
  projectStage: ProjectStageValue
}) {
  return run(() => svc.loadWeeklyReportFilePicker(input))
}

export async function upsertWeeklyReportItemAction(input: {
  reportId: string
  itemId?: string | null
  item_type: 'work' | 'plan'
  item_desc: string | null
  work_slots: WeekHalfSlot[]
  file_ids: string[]
}) {
  return run(() => svc.upsertItem(input))
}

export async function deleteWeeklyReportItemAction(input: {
  reportId: string
  itemId: string
}) {
  return run(() => svc.deleteItem(input))
}

export async function loadWeeklyReportDetailAction(reportId: string) {
  return run(() => svc.loadDetail(reportId))
}

export async function getWeeklyReportMetaForUserWeekAction(input: {
  projectId: string
  weekCode: string
  projectStage: ProjectStageValue
}) {
  return run(() => svc.getMetaForUserWeek(input))
}

export async function submitWeeklyReportForApprovalAction(input: {
  reportId: string
  noNextWeekPlan?: boolean
}) {
  return run(() => svc.submitForApproval(input))
}

export async function submitWeeklyReportApprovalDecisionAction(input: {
  reportId: string
  decision: 'approve' | 'reject'
  rejectReason?: string | null
}) {
  return run(() => svc.submitApprovalDecision(input))
}

export async function withdrawWeeklyReportAction(input: { reportId: string }) {
  return run(() => svc.withdrawReport(input))
}

export async function deleteWeeklyReportAction(input: { reportId: string }) {
  return run(() => svc.deleteReport(input))
}
