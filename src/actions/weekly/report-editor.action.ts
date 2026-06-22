'use server'

import { handleAction } from '@/lib/action-handler'
import { AuthError, ValidationError } from '@/lib/errors'
import { getProfileById } from '@/lib/db/auth/profile'
import {
  applyWeeklyReportApprovalDb,
  deleteWeeklyReportItemDb,
  getUsedWorkSlotKeysForReport,
  getUsedWorkSlotKeysForUserWeekOtherReports,
  getWeekBoundsByCode,
  getWeeklyReportApprovalByApprover,
  getWeeklyReportMetaForUserWeek,
  isUserProjectMember,
  listDeliverableFilesForWeeklyPicker,
  loadWeeklyReportEditorPayload,
  loadWeeklyReportDetail,
  upsertWeeklyReportItemDb,
  verifyFilesLinkableToWeeklyItem,
} from '@/lib/db/weekly/report-editor'
import { isProjectWeekExempt } from '@/lib/db/weekly/exemptions'
import { getPmProjectIdsForUser, projectHasPm } from '@/lib/db/weekly/reports'
import { nextWeekRangeAfterWeekEnd } from '@/lib/utils/week-report-dates'
import { isWeeklyReportEditableStatus } from '@/constants/weekly-report-status'
import { isNowAfterWeekDeadline } from '@/lib/utils/week-deadline'
import {
  everySlotInRange,
  parseWorkDatesJson,
  weekHalfSlotToKey,
  weekHalfSlotsToWorkDays,
  type WeekHalfSlot,
} from '@/lib/utils/weekly-report-work-slots'
import { createClient } from '@/lib/supabase/server'
import { handleDbError } from '@/lib/db/handle-db-error'
import type { Json } from '@/types/database'

async function requireProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new AuthError('请先登录')

  const profile = await getProfileById(user.id)
  if (!profile) throw new AuthError('请先登录')
  return profile
}

export async function loadWeeklyReportEditorAction(input: {
  projectId: string
  weekCode: string
}) {
  return handleAction(async () => {
    const profile = await requireProfile()
    if (await isProjectWeekExempt(input.projectId, input.weekCode)) {
      throw new ValidationError('项目经理已经设置本周无工作周，无法填写')
    }
    const payload = await loadWeeklyReportEditorPayload(
      profile.id,
      input.projectId,
      input.weekCode
    )
    if (!payload) {
      throw new ValidationError('无法加载周报或该周次已提交，不可编辑')
    }
    return payload
  })
}

export async function loadDeliverableFilesForWeeklyPickerAction(input: {
  projectId: string
  weekStartDate: string
}) {
  return handleAction(async () => {
    const profile = await requireProfile()
    const ok = await isUserProjectMember(profile.id, input.projectId)
    if (!ok) throw new ValidationError('无权访问该项目')
    return listDeliverableFilesForWeeklyPicker(
      input.projectId,
      input.weekStartDate
    )
  })
}

export async function upsertWeeklyReportItemAction(input: {
  reportId: string
  itemId?: string | null
  item_type: 'work' | 'plan'
  item_desc: string | null
  work_slots: WeekHalfSlot[]
  file_ids: string[]
}) {
  return handleAction(async () => {
    const profile = await requireProfile()
    const supabase = await createClient()

    const { data: report, error: e0 } = await supabase
      .from('weekly_reports')
      .select('id, user_id, status, project_id, week_code')
      .eq('id', input.reportId)
      .maybeSingle()

    if (e0) handleDbError(e0)
    if (!report) throw new ValidationError('周报不存在')
    if (report.user_id !== profile.id) {
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

    const slots = parseWorkDatesJson(input.work_slots as unknown as Json)
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
      if (
        !everySlotInRange(
          slots,
          nextWeek.start_date,
          nextWeek.end_date
        )
      ) {
        throw new ValidationError('下周计划的半天须落在下一自然周内')
      }
    }

    const usedSameReport = await getUsedWorkSlotKeysForReport(
      input.reportId,
      input.item_type,
      input.itemId ?? null
    )
    const usedOtherProjects = await getUsedWorkSlotKeysForUserWeekOtherReports(
      profile.id,
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
      supabase,
      uniq,
      report.project_id
    )
    if (!okFiles) throw new ValidationError('关联文件无效或不属于本项目成果')

    const { id } = await upsertWeeklyReportItemDb({
      reportId: input.reportId,
      itemId: input.itemId,
      item_type: input.item_type,
      item_desc: desc,
      work_slots: slots,
      file_ids: uniq,
    })

    return {
      id,
      work_days: weekHalfSlotsToWorkDays(slots),
    }
  })
}

export async function deleteWeeklyReportItemAction(input: {
  reportId: string
  itemId: string
}) {
  return handleAction(async () => {
    const profile = await requireProfile()
    const supabase = await createClient()

    const { data: report, error: e0 } = await supabase
      .from('weekly_reports')
      .select('id, user_id, status, project_id, week_code')
      .eq('id', input.reportId)
      .maybeSingle()

    if (e0) handleDbError(e0)
    if (!report) throw new ValidationError('周报不存在')
    if (report.user_id !== profile.id) {
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
  })
}

export async function loadWeeklyReportDetailAction(reportId: string) {
  return handleAction(async () => {
    await requireProfile()
    const detail = await loadWeeklyReportDetail(reportId)
    if (!detail) throw new ValidationError('周报不存在')
    return detail
  })
}

/** 新建页：若该周已提交则返回已存在周报 id，供前端跳转详情 */
export async function getWeeklyReportMetaForUserWeekAction(input: {
  projectId: string
  weekCode: string
}) {
  return handleAction(async () => {
    const profile = await requireProfile()
    return getWeeklyReportMetaForUserWeek(
      profile.id,
      input.projectId,
      input.weekCode
    )
  })
}

/**
 * 草稿 → 提交：若项目存在项目经理则进入待审批；若无项目经理则直接为已审批（无需 PM 审批）。
 */
export async function submitWeeklyReportForApprovalAction(input: {
  reportId: string
  /** 为 true 时先删除本周报全部「下周计划」项，再提交（下周无计划） */
  noNextWeekPlan?: boolean
}) {
  return handleAction(async () => {
    const profile = await requireProfile()
    const supabase = await createClient()

    const { data: report, error: e0 } = await supabase
      .from('weekly_reports')
      .select('id, user_id, status, week_code, project_id')
      .eq('id', input.reportId)
      .maybeSingle()

    if (e0) handleDbError(e0)
    if (!report) throw new ValidationError('周报不存在')
    if (report.user_id !== profile.id) {
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
      const { error: delPlanErr } = await supabase
        .from('weekly_report_items')
        .delete()
        .eq('report_id', input.reportId)
        .eq('item_type', 'plan')
      if (delPlanErr) handleDbError(delPlanErr)
    } else {
      const { count: planCount, error: pcErr } = await supabase
        .from('weekly_report_items')
        .select('id', { count: 'exact', head: true })
        .eq('report_id', input.reportId)
        .eq('item_type', 'plan')
      if (pcErr) handleDbError(pcErr)
      if ((planCount ?? 0) < 1) {
        throw new ValidationError(
          '请至少填写并保存一条下周计划后再提交，或开启「下周无计划」'
        )
      }
    }

    const { count, error: e1 } = await supabase
      .from('weekly_report_items')
      .select('id', { count: 'exact', head: true })
      .eq('report_id', input.reportId)
      .eq('item_type', 'work')

    if (e1) handleDbError(e1)
    if ((count ?? 0) < 1) {
      throw new ValidationError('请至少填写并保存一条本周工作内容后再提交')
    }

    const hasPm = await projectHasPm(report.project_id)
    const nextStatus = hasPm ? 'pending' : 'approved'

    const { data: updated, error: e2 } = await supabase
      .from('weekly_reports')
      .update({
        status: nextStatus,
        submit_time: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_overdue: submitOverdue,
      })
      .eq('id', input.reportId)
      .eq('user_id', profile.id)
      .in('status', ['draft', 'rejected'])
      .select('id')
      .maybeSingle()

    if (e2) handleDbError(e2)
    if (!updated) {
      throw new ValidationError('提交失败，请刷新页面后重试')
    }
  })
}

/** 项目经理：待审批周报 → 通过 / 驳回 */
export async function submitWeeklyReportApprovalDecisionAction(input: {
  reportId: string
  decision: 'approve' | 'reject'
  rejectReason?: string | null
}) {
  return handleAction(async () => {
    const profile = await requireProfile()
    const rejectReason = input.rejectReason?.trim() ?? null

    if (input.decision === 'reject' && !rejectReason) {
      throw new ValidationError('请填写驳回原因')
    }

    const detail = await loadWeeklyReportDetail(input.reportId)
    if (!detail) throw new ValidationError('周报不存在')
    if (detail.report.user_id === profile.id) {
      throw new ValidationError('不能审批自己的周报')
    }

    const pmIds = await getPmProjectIdsForUser(profile.id)
    if (!pmIds.includes(detail.report.project_id)) {
      throw new ValidationError('无权审批该周报')
    }

    if (detail.report.status !== 'pending') {
      throw new ValidationError('该周报已处理')
    }

    const existing = await getWeeklyReportApprovalByApprover(
      input.reportId,
      profile.id,
      detail.report.submit_time
    )
    if (existing) {
      throw new ValidationError('您已审批过该周报')
    }

    const { applied } = await applyWeeklyReportApprovalDb({
      reportId: input.reportId,
      approverId: profile.id,
      decision: input.decision,
      rejectReason: input.decision === 'reject' ? rejectReason : null,
    })

    if (!applied) {
      throw new ValidationError('审批失败，该周报可能已被处理，请刷新后重试')
    }
  })
}
