import { requireUser } from '@/core/auth'
import { ValidationError } from '@/core/errors'
import { isWeeklyReportEditableStatus } from '@/constants/weekly-report-status'
import { isNowAfterWeekDeadline } from '@/modules/weekly/lib/week-deadline'
import type { ProjectStageValue } from '@/constants/project-stage'
import { nextWeekRangeAfterWeekEnd } from '@/modules/weekly/lib/week-report-dates'
import {
  everySlotInRange,
  weekHalfSlotToKey,
  weekHalfSlotsToWorkDays,
  type WeekHalfSlot,
} from '@/modules/weekly/lib/weekly-report-work-slots'
import { isProjectWeekExempt } from '../exemptions/repo'
import { getPmProjectIdsForUser } from '../reports/repo'
import {
  applyWeeklyReportApprovalDb,
  deleteWeeklyReportItemDb,
  getUsedWorkSlotKeysForReport,
  getUsedWorkSlotKeysForUserWeekOtherReports,
  getWeekBoundsByCode,
  getWeeklyReportApprovalByApprover,
  getWeeklyReportMetaForUserWeek,
  isUserProjectMember,
  listWeeklyReportFilesForPicker,
  loadWeeklyReportDetail,
  loadWeeklyReportEditorPayload,
  upsertWeeklyReportItemDb,
  verifyFilesLinkableToWeeklyItem,
  getReportForEdit,
  submitWeeklyReportDb,
  deletePlanItemsDb,
  countPlanItemsDb,
  countWorkItemsDb,
  deleteWeeklyReportDb,
  isUserImplementationProjectManager,
  withdrawWeeklyReportDb,
} from './repo'
import type { WeeklyReportItemType } from '../types'

export async function loadEditor(input: {
  projectId: string
  weekCode: string
  projectStage: ProjectStageValue
}) {
  const user = await requireUser()
  if (await isProjectWeekExempt(input.projectId, input.weekCode)) {
    throw new ValidationError('项目经理已经设置本周无工作周，无法填写')
  }
  const payload = await loadWeeklyReportEditorPayload(
    user.id,
    input.projectId,
    input.weekCode,
    input.projectStage
  )
  if (!payload) {
    throw new ValidationError('无法加载周报或该周次已提交，不可编辑')
  }
  return payload
}

export async function loadWeeklyReportFilePicker(input: {
  projectId: string
  weekStartDate: string
  projectStage: ProjectStageValue
}) {
  const user = await requireUser()
  const ok = await isUserProjectMember(
    user.id,
    input.projectId,
    input.projectStage
  )
  if (!ok) throw new ValidationError('无权访问该项目')
  return listWeeklyReportFilesForPicker(
    input.projectId,
    input.weekStartDate,
    input.projectStage
  )
}

export async function upsertItem(input: {
  reportId: string
  itemId?: string | null
  item_type: WeeklyReportItemType
  item_desc: string | null
  work_slots: WeekHalfSlot[]
  file_ids: string[]
}) {
  const user = await requireUser()
  const report = await getReportForEdit(input.reportId)
  if (!report) throw new ValidationError('周报不存在')
  if (report.user_id !== user.id) {
    throw new ValidationError('无权编辑该周报')
  }
  if (!isWeeklyReportEditableStatus(report.status)) {
    throw new ValidationError('仅草稿或已退回的周报可编辑')
  }
  if (await isProjectWeekExempt(report.project_id, report.week_code)) {
    throw new ValidationError('项目经理已经设置本周无工作周，无法填写')
  }

  const week = await getWeekBoundsByCode(report.week_code)
  if (!week) throw new ValidationError('周次数据异常')

  const slots = input.work_slots
  if (!slots.length) {
    throw new ValidationError('请选择至少半个工作日')
  }

  const desc = input.item_desc?.trim()
  if (!desc) throw new ValidationError('请填写内容')

  const nextWeek = nextWeekRangeAfterWeekEnd(week.end_date)
  if (input.item_type === 'work') {
    if (!everySlotInRange(slots, week.start_date, week.end_date)) {
      throw new ValidationError('本周事项的工作半天须落在本填报周内')
    }
  } else {
    if (!everySlotInRange(slots, nextWeek.start_date, nextWeek.end_date)) {
      throw new ValidationError('下周计划的半天须落在下一自然周内')
    }
  }

  const usedSameReport = await getUsedWorkSlotKeysForReport(
    input.reportId,
    input.item_type,
    input.itemId ?? null
  )
  const usedOtherProjects = await getUsedWorkSlotKeysForUserWeekOtherReports(
    user.id,
    report.week_code,
    input.reportId,
    input.item_type
  )
  for (const s of slots) {
    const k = weekHalfSlotToKey(s)
    if (usedSameReport.has(k)) {
      throw new ValidationError('同一半天在本周报内只能使用一次')
    }
    if (usedOtherProjects.has(k)) {
      throw new ValidationError('该半天在本填报周内已用于其他项目的周报')
    }
  }

  const uniq = [...new Set(input.file_ids)]
  const okFiles = await verifyFilesLinkableToWeeklyItem(
    uniq,
    report.project_id,
    report.project_stage,
    week.start_date
  )
  if (!okFiles) throw new ValidationError('关联文件无效或不符合本周报阶段')

  const { id } = await upsertWeeklyReportItemDb({
    reportId: input.reportId,
    itemId: input.itemId,
    item_type: input.item_type,
    item_desc: desc,
    work_slots: slots,
    file_ids: uniq,
  })

  return { id, work_days: weekHalfSlotsToWorkDays(slots) }
}

export async function deleteItem(input: { reportId: string; itemId: string }) {
  const user = await requireUser()
  const report = await getReportForEdit(input.reportId)
  if (!report) throw new ValidationError('周报不存在')
  if (report.user_id !== user.id) {
    throw new ValidationError('无权编辑该周报')
  }
  if (!isWeeklyReportEditableStatus(report.status)) {
    throw new ValidationError('仅草稿或已退回的周报可编辑')
  }
  if (await isProjectWeekExempt(report.project_id, report.week_code)) {
    throw new ValidationError('项目经理已经设置本周无工作周，无法填写')
  }
  await deleteWeeklyReportItemDb({
    reportId: input.reportId,
    itemId: input.itemId,
  })
}

export async function loadDetail(reportId: string) {
  await requireUser()
  const detail = await loadWeeklyReportDetail(reportId)
  if (!detail) throw new ValidationError('周报不存在')
  return detail
}

export async function getMetaForUserWeek(input: {
  projectId: string
  weekCode: string
  projectStage: ProjectStageValue
}) {
  const user = await requireUser()
  return getWeeklyReportMetaForUserWeek(
    user.id,
    input.projectId,
    input.weekCode,
    input.projectStage
  )
}

export async function submitForApproval(input: {
  reportId: string
  noNextWeekPlan?: boolean
}) {
  const user = await requireUser()
  const report = await getReportForEdit(input.reportId)
  if (!report) throw new ValidationError('周报不存在')
  if (report.user_id !== user.id) {
    throw new ValidationError('无权提交该周报')
  }
  if (!isWeeklyReportEditableStatus(report.status)) {
    throw new ValidationError('仅草稿或已退回的周报可提交审批')
  }
  if (await isProjectWeekExempt(report.project_id, report.week_code)) {
    throw new ValidationError('项目经理已经设置本周无工作周，无法填写')
  }

  const week = await getWeekBoundsByCode(report.week_code)
  if (!week) throw new ValidationError('周次数据异常')
  const submitOverdue = isNowAfterWeekDeadline(week.deadline)

  if (input.noNextWeekPlan) {
    await deletePlanItemsDb(input.reportId)
  } else {
    const planCount = await countPlanItemsDb(input.reportId)
    if (planCount < 1) {
      throw new ValidationError(
        '请至少填写并保存一条下周计划后再提交，或开启「下周无计划」'
      )
    }
  }

  const workCount = await countWorkItemsDb(input.reportId)
  if (workCount < 1) {
    throw new ValidationError('请至少填写并保存一条本周工作内容后再提交')
  }

  const isImplementationPm =
    report.project_stage === '实施阶段' &&
    (await isUserImplementationProjectManager(user.id, report.project_id))
  const nextStatus =
    report.project_stage === '实施阶段' && !isImplementationPm
      ? 'pending'
      : 'approved'

  const ok = await submitWeeklyReportDb({
    reportId: input.reportId,
    userId: user.id,
    nextStatus,
    submitOverdue,
  })
  if (!ok) {
    throw new ValidationError('提交失败，请刷新页面后重试')
  }
}

export async function submitApprovalDecision(input: {
  reportId: string
  decision: 'approve' | 'reject'
  rejectReason?: string | null
}) {
  const user = await requireUser()
  const rejectReason = input.rejectReason?.trim() ?? null

  if (input.decision === 'reject' && !rejectReason) {
    throw new ValidationError('请填写驳回原因')
  }

  const detail = await loadWeeklyReportDetail(input.reportId)
  if (!detail) throw new ValidationError('周报不存在')
  if (detail.report.user_id === user.id) {
    throw new ValidationError('不能审批自己的周报')
  }

  const pmIds = await getPmProjectIdsForUser(user.id)
  if (!pmIds.includes(detail.report.project_id)) {
    throw new ValidationError('无权审批该周报')
  }

  if (detail.report.status !== 'pending') {
    throw new ValidationError('该周报已处理')
  }

  const existing = await getWeeklyReportApprovalByApprover(
    input.reportId,
    user.id,
    detail.report.submit_time
  )
  if (existing) {
    throw new ValidationError('您已审批过该周报')
  }

  const { applied } = await applyWeeklyReportApprovalDb({
    reportId: input.reportId,
    approverId: user.id,
    decision: input.decision,
    rejectReason: input.decision === 'reject' ? rejectReason : null,
  })

  if (!applied) {
    throw new ValidationError('审批失败，该周报可能已被处理，请刷新后重试')
  }
}

export async function withdrawReport(input: { reportId: string }) {
  const user = await requireUser()
  const report = await getReportForEdit(input.reportId)
  if (!report) throw new ValidationError('周报不存在')
  if (report.user_id !== user.id) {
    throw new ValidationError('无权撤回该周报')
  }
  if (report.status !== 'pending' && report.status !== 'approved') {
    throw new ValidationError('仅已提交或已通过的周报可撤回')
  }

  const since = new Date()
  since.setDate(since.getDate() - 28)
  const ok = await withdrawWeeklyReportDb({
    reportId: input.reportId,
    userId: user.id,
    since,
  })
  if (!ok) {
    throw new ValidationError('仅允许撤回提交后 4 周内的周报')
  }
}

export async function deleteReport(input: { reportId: string }) {
  const user = await requireUser()
  const report = await getReportForEdit(input.reportId)
  if (!report) throw new ValidationError('周报不存在')
  if (report.user_id !== user.id) {
    throw new ValidationError('无权删除该周报')
  }
  if (report.status !== 'draft' && report.status !== 'withdrawn') {
    throw new ValidationError('仅草稿和已撤回的周报可以删除')
  }

  const ok = await deleteWeeklyReportDb({
    reportId: input.reportId,
    userId: user.id,
  })
  if (!ok) throw new ValidationError('删除失败，请刷新后重试')
}
