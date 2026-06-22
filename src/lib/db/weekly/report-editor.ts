import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { handleDbError } from '@/lib/db/handle-db-error'
import { isProjectWeekExempt } from '@/lib/db/weekly/exemptions'
import { nextWeekRangeAfterWeekEnd } from '@/lib/utils/week-report-dates'
import {
  parseWeekHalfSlotKey,
  parseWorkDatesJson,
  weekHalfSlotToKey,
  weekHalfSlotsToWorkDays,
  workSlotsToJson,
  type WeekHalfSlot,
} from '@/lib/utils/weekly-report-work-slots'
import { isWeeklyReportEditableStatus } from '@/constants/weekly-report-status'
import type { Enums } from '@/types/database'

type WeeklyReportItemType = Enums<'weekly_report_item_type'>
import type {
  DeliverablePickRow,
  WeeklyReportDetailPayload,
  WeeklyReportEditorItem,
  WeeklyReportEditorPayload,
  WeeklyReportEditorProject,
  WeeklyReportWeekBounds,
} from '@/types/weekly-report-editor'

type ServerClient = Awaited<ReturnType<typeof createClient>>

export async function getWeekBoundsByCode(
  weekCode: string
): Promise<WeeklyReportWeekBounds | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('weeks')
    .select('week_code, start_date, end_date, deadline')
    .eq('week_code', weekCode)
    .maybeSingle()

  if (error) handleDbError(error)
  if (!data?.start_date || !data?.end_date) return null
  return {
    week_code: data.week_code,
    start_date: data.start_date,
    end_date: data.end_date,
    deadline: data.deadline ?? null,
  }
}

export async function isUserProjectMember(
  userId: string,
  projectId: string
): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) handleDbError(error)
  return !!data
}

async function fetchProjectBrief(
  supabase: ServerClient,
  projectId: string
): Promise<WeeklyReportEditorProject | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, project_no, project_name')
    .eq('id', projectId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) handleDbError(error)
  if (!data) return null
  return {
    id: data.id,
    project_no: data.project_no,
    project_name: data.project_name,
  }
}

export async function getWeeklyReportMetaForUserWeek(
  userId: string,
  projectId: string,
  weekCode: string
): Promise<{ id: string; status: Enums<'weekly_report_status'> } | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('weekly_reports')
    .select('id, status')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .eq('week_code', weekCode)
    .maybeSingle()

  if (error) handleDbError(error)
  if (!data) return null
  return { id: data.id, status: data.status }
}

export async function getOrCreateDraftReport(
  userId: string,
  projectId: string,
  weekCode: string
): Promise<{ id: string }> {
  const supabase = await createClient()

  const { data: existing, error: e0 } = await supabase
    .from('weekly_reports')
    .select('id')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .eq('week_code', weekCode)
    .maybeSingle()

  if (e0) handleDbError(e0)
  if (existing?.id) return { id: existing.id }

  const { data: created, error: e1 } = await supabase
    .from('weekly_reports')
    .insert({
      user_id: userId,
      project_id: projectId,
      week_code: weekCode,
      status: 'draft',
    })
    .select('id')
    .single()

  if (e1) handleDbError(e1)
  return { id: created.id }
}

async function loadItemsWithFiles(
  supabase: ServerClient,
  reportId: string
): Promise<WeeklyReportEditorItem[]> {
  const { data: items, error: e0 } = await supabase
    .from('weekly_report_items')
    .select(
      'id, item_desc, item_type, work_dates, work_days, sort_order'
    )
    .eq('report_id', reportId)
    .order('sort_order', { ascending: true })

  if (e0) handleDbError(e0)
  const list = items ?? []
  if (!list.length) return []

  const itemIds = list.map((i) => i.id)
  const { data: links, error: e1 } = await supabase
    .from('weekly_report_file_links')
    .select('report_item_id, file_id')
    .in('report_item_id', itemIds)

  if (e1) handleDbError(e1)

  const fileIds = [...new Set((links ?? []).map((l) => l.file_id))]
  const fileMeta = new Map<string, { file_name: string }>()
  if (fileIds.length) {
    const { data: files, error: e2 } = await supabase
      .from('files')
      .select('id, file_name')
      .in('id', fileIds)

    if (e2) handleDbError(e2)
    for (const f of files ?? []) {
      fileMeta.set(f.id, { file_name: f.file_name })
    }
  }

  const filesByItem = new Map<string, { id: string; file_name: string }[]>()
  for (const l of links ?? []) {
    const meta = fileMeta.get(l.file_id)
    if (!meta) continue
    const arr = filesByItem.get(l.report_item_id) ?? []
    arr.push({ id: l.file_id, file_name: meta.file_name })
    filesByItem.set(l.report_item_id, arr)
  }

  return list.map((it) => {
    const fs = filesByItem.get(it.id) ?? []
    const slots = parseWorkDatesJson(it.work_dates)
    const wd =
      it.work_days != null ? Number(it.work_days) : weekHalfSlotsToWorkDays(slots)
    return {
      id: it.id,
      item_type: it.item_type,
      item_desc: it.item_desc,
      work_slots: slots,
      work_days: Number.isFinite(wd) ? wd : null,
      sort_order: it.sort_order ?? 0,
      file_ids: fs.map((x) => x.id),
      files: fs,
    }
  })
}

function mapRawRowsToEditorItems(
  list: {
    id: string
    item_desc: string | null
    item_type: WeeklyReportItemType
    work_dates: import('@/types/database').Json | null
    work_days: number | null
    sort_order: number | null
  }[],
  filesByItem: Map<string, { id: string; file_name: string }[]>
): WeeklyReportEditorItem[] {
  return list.map((it) => {
    const fs = filesByItem.get(it.id) ?? []
    const slots = parseWorkDatesJson(it.work_dates)
    const wd =
      it.work_days != null ? Number(it.work_days) : weekHalfSlotsToWorkDays(slots)
    return {
      id: it.id,
      item_type: it.item_type,
      item_desc: it.item_desc,
      work_slots: slots,
      work_days: Number.isFinite(wd) ? wd : null,
      sort_order: it.sort_order ?? 0,
      file_ids: fs.map((x) => x.id),
      files: fs,
    }
  })
}

/**
 * 批量加载多份周报下的事项（含关联文件），按 report_id 分组。
 */
async function loadItemsWithFilesForReportIds(
  supabase: ServerClient,
  reportIds: string[]
): Promise<Map<string, WeeklyReportEditorItem[]>> {
  const out = new Map<string, WeeklyReportEditorItem[]>()
  if (!reportIds.length) return out

  const { data: rows, error: e0 } = await supabase
    .from('weekly_report_items')
    .select(
      'id, report_id, item_desc, item_type, work_dates, work_days, sort_order'
    )
    .in('report_id', reportIds)
    .order('report_id', { ascending: true })
    .order('sort_order', { ascending: true })

  if (e0) handleDbError(e0)
  const list = rows ?? []
  if (!list.length) return out

  const itemIds = list.map((i) => i.id)
  const { data: links, error: e1 } = await supabase
    .from('weekly_report_file_links')
    .select('report_item_id, file_id')
    .in('report_item_id', itemIds)

  if (e1) handleDbError(e1)

  const fileIds = [...new Set((links ?? []).map((l) => l.file_id))]
  const fileMeta = new Map<string, { file_name: string }>()
  if (fileIds.length) {
    const { data: files, error: e2 } = await supabase
      .from('files')
      .select('id, file_name')
      .in('id', fileIds)

    if (e2) handleDbError(e2)
    for (const f of files ?? []) {
      fileMeta.set(f.id, { file_name: f.file_name })
    }
  }

  const filesByItem = new Map<string, { id: string; file_name: string }[]>()
  for (const l of links ?? []) {
    const meta = fileMeta.get(l.file_id)
    if (!meta) continue
    const arr = filesByItem.get(l.report_item_id) ?? []
    arr.push({ id: l.file_id, file_name: meta.file_name })
    filesByItem.set(l.report_item_id, arr)
  }

  const byReport = new Map<string, typeof list>()
  for (const row of list) {
    const rid = row.report_id
    if (!byReport.has(rid)) byReport.set(rid, [])
    byReport.get(rid)!.push(row)
  }

  for (const [rid, group] of byReport) {
    out.set(
      rid,
      mapRawRowsToEditorItems(group, filesByItem)
    )
  }
  return out
}

/** 供项目「周详情」页聚合多人工作事项 */
export async function loadWeeklyReportItemsForReportIds(
  reportIds: string[]
): Promise<Map<string, WeeklyReportEditorItem[]>> {
  const supabase = await createClient()
  return loadItemsWithFilesForReportIds(supabase, reportIds)
}

export async function loadWeeklyReportEditorPayload(
  userId: string,
  projectId: string,
  weekCode: string
): Promise<WeeklyReportEditorPayload | null> {
  const supabase = await createClient()
  const week = await getWeekBoundsByCode(weekCode)
  if (!week) return null

  const member = await isUserProjectMember(userId, projectId)
  if (!member) return null

  const project = await fetchProjectBrief(supabase, projectId)
  if (!project) return null

  if (await isProjectWeekExempt(projectId, weekCode)) {
    return null
  }

  const { id: reportId } = await getOrCreateDraftReport(
    userId,
    projectId,
    weekCode
  )

  const { data: report, error: e0 } = await supabase
    .from('weekly_reports')
    .select('id, status, user_id, project_id, week_code, is_overdue')
    .eq('id', reportId)
    .single()

  if (e0) handleDbError(e0)
  if (report.user_id !== userId) return null
  if (!isWeeklyReportEditableStatus(report.status)) {
    return null
  }

  const items = await loadItemsWithFiles(supabase, reportId)

  const [workKeysOther, planKeysOther] = await Promise.all([
    getUsedWorkSlotKeysForUserWeekOtherReports(
      userId,
      weekCode,
      reportId,
      'work'
    ),
    getUsedWorkSlotKeysForUserWeekOtherReports(
      userId,
      weekCode,
      reportId,
      'plan'
    ),
  ])

  return {
    report: {
      id: report.id,
      status: report.status,
      user_id: report.user_id,
      project_id: report.project_id,
      week_code: report.week_code,
      is_overdue: !!report.is_overdue,
    },
    week,
    next_week: nextWeekRangeAfterWeekEnd(week.end_date),
    project,
    items,
    used_slots_other_reports_work: weekHalfSlotKeysToSlots(workKeysOther),
    used_slots_other_reports_plan: weekHalfSlotKeysToSlots(planKeysOther),
  }
}

export async function listDeliverableFilesForWeeklyPicker(
  projectId: string,
  weekStartDate: string
): Promise<DeliverablePickRow[]> {
  const supabase = await createClient()
  const startIso = `${weekStartDate}T00:00:00.000Z`

  const { data, error } = await supabase
    .from('files')
    .select('id, file_name, created_at, version_label, is_latest')
    .eq('project_id', projectId)
    .eq('is_deliverable', true)
    .gte('created_at', startIso)
    .order('created_at', { ascending: false })

  if (error) handleDbError(error)
  return (data ?? []).map((r) => ({
    id: r.id,
    file_name: r.file_name,
    created_at: r.created_at ?? '',
    version_label: r.version_label,
    is_latest: r.is_latest ?? false,
  }))
}

export async function verifyFilesLinkableToWeeklyItem(
  supabase: ServerClient,
  fileIds: string[],
  projectId: string
): Promise<boolean> {
  if (!fileIds.length) return true
  const { data, error } = await supabase
    .from('files')
    .select('id')
    .in('id', fileIds)
    .eq('project_id', projectId)
    .eq('is_deliverable', true)

  if (error) handleDbError(error)
  const ok = new Set((data ?? []).map((r) => r.id))
  return fileIds.every((id) => ok.has(id))
}

export async function loadWeeklyReportDetail(
  reportId: string
): Promise<WeeklyReportDetailPayload | null> {
  const supabase = await createClient()

  const { data: report, error: e0 } = await supabase
    .from('weekly_reports')
    .select(
      'id, status, user_id, project_id, week_code, submit_time, created_at, is_overdue'
    )
    .eq('id', reportId)
    .maybeSingle()

  if (e0) handleDbError(e0)
  if (!report) return null

  const week = await getWeekBoundsByCode(report.week_code)
  if (!week) return null

  const project = await fetchProjectBrief(supabase, report.project_id)
  if (!project) return null

  const { data: author, error: e1 } = await supabase
    .from('users')
    .select('name')
    .eq('id', report.user_id)
    .maybeSingle()

  if (e1) handleDbError(e1)

  const items = await loadItemsWithFiles(supabase, reportId)

  let rejectReason: string | null = null
  if (report.status === 'rejected') {
    const { data: rej, error: eRej } = await supabase
      .from('weekly_report_approvals')
      .select('reject_reason')
      .eq('report_id', reportId)
      .eq('action', 'reject')
      .order('approved_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (eRej) handleDbError(eRej)
    const raw = rej?.reject_reason?.trim()
    rejectReason = raw ? raw : null
  }

  return {
    report: {
      id: report.id,
      status: report.status,
      user_id: report.user_id,
      project_id: report.project_id,
      week_code: report.week_code,
      submit_time: report.submit_time,
      created_at: report.created_at,
      is_overdue: !!report.is_overdue,
    },
    week,
    next_week: nextWeekRangeAfterWeekEnd(week.end_date),
    project,
    author_name: author?.name?.trim() || null,
    items,
    reject_reason: rejectReason,
  }
}

/**
 * 当前「提交轮次」下该审批人对该周报的审批记录。
 * 以 `weekly_reports.submit_time` 为界：成员重新提交后 `submit_time` 更新，更早的审批记录不再计入。
 */
export async function getWeeklyReportApprovalByApprover(
  reportId: string,
  approverId: string,
  submitTime: string | null
): Promise<{
  action: 'approve' | 'reject'
  reject_reason: string | null
  approved_at: string | null
} | null> {
  if (!submitTime) return null

  const supabase = await createClient()
  const { data: rows, error } = await supabase
    .from('weekly_report_approvals')
    .select('action, reject_reason, approved_at, created_at')
    .eq('report_id', reportId)
    .eq('approver_id', approverId)
    .order('approved_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) handleDbError(error)
  const threshold = new Date(submitTime).getTime()
  if (Number.isNaN(threshold)) return null

  for (const r of rows ?? []) {
    const t =
      r.approved_at != null
        ? new Date(r.approved_at).getTime()
        : new Date(r.created_at).getTime()
    if (!Number.isNaN(t) && t >= threshold) {
      return {
        action: r.action,
        reject_reason: r.reject_reason,
        approved_at: r.approved_at,
      }
    }
  }
  return null
}

/**
 * 审批通过/驳回：先更新 `weekly_reports`（仅 action 层已校验 PM），再写 `weekly_report_approvals`。
 * 使用 service role 执行，避免 RLS 下 UPDATE 已生效但 `RETURNING` 为空导致误判。
 */
export async function applyWeeklyReportApprovalDb(input: {
  reportId: string
  approverId: string
  decision: 'approve' | 'reject'
  rejectReason: string | null
}): Promise<{ applied: boolean }> {
  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const newStatus = input.decision === 'approve' ? 'approved' : 'rejected'

  const { data: updated, error: e0 } = await supabase
    .from('weekly_reports')
    .update({
      status: newStatus,
      updated_at: now,
    })
    .eq('id', input.reportId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (e0) handleDbError(e0)
  if (!updated?.id) return { applied: false }

  const { error: e1 } = await supabase.from('weekly_report_approvals').insert({
    report_id: input.reportId,
    approver_id: input.approverId,
    action: input.decision,
    reject_reason: input.decision === 'reject' ? input.rejectReason : null,
    approved_at: now,
    is_overdue: false,
  })

  if (e1) {
    const { error: eRollback } = await supabase
      .from('weekly_reports')
      .update({
        status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.reportId)
      .eq('status', newStatus)
    if (eRollback) handleDbError(eRollback)
    handleDbError(e1)
  }

  return { applied: true }
}

/** 将半天键集合转为列表（供 payload 下发前端） */
function weekHalfSlotKeysToSlots(keys: Set<string>): WeekHalfSlot[] {
  const out: WeekHalfSlot[] = []
  for (const k of keys) {
    const p = parseWeekHalfSlotKey(k)
    if (p) out.push(p)
  }
  return out
}

/**
 * 同一用户、同一 week_code 下，排除 `excludeReportId` 后，其他周报中已占用的半天键。
 */
export async function getUsedWorkSlotKeysForUserWeekOtherReports(
  userId: string,
  weekCode: string,
  excludeReportId: string,
  itemType: WeeklyReportItemType
): Promise<Set<string>> {
  const supabase = await createClient()
  const { data: reports, error: e0 } = await supabase
    .from('weekly_reports')
    .select('id')
    .eq('user_id', userId)
    .eq('week_code', weekCode)
    .neq('id', excludeReportId)

  if (e0) handleDbError(e0)
  const reportIds = (reports ?? []).map((r) => r.id).filter(Boolean)
  if (!reportIds.length) return new Set()

  const { data: items, error: e1 } = await supabase
    .from('weekly_report_items')
    .select('work_dates')
    .eq('item_type', itemType)
    .in('report_id', reportIds)

  if (e1) handleDbError(e1)
  const keys = new Set<string>()
  for (const row of items ?? []) {
    for (const s of parseWorkDatesJson(row.work_dates)) {
      keys.add(weekHalfSlotToKey(s))
    }
  }
  return keys
}

/** 同周报、同 `item_type` 下已占用的半天键（不含 `excludeItemId`） */
export async function getUsedWorkSlotKeysForReport(
  reportId: string,
  itemType: WeeklyReportItemType,
  excludeItemId?: string | null
): Promise<Set<string>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('weekly_report_items')
    .select('id, work_dates')
    .eq('report_id', reportId)
    .eq('item_type', itemType)

  if (error) handleDbError(error)
  const keys = new Set<string>()
  for (const row of data ?? []) {
    if (excludeItemId && row.id === excludeItemId) continue
    for (const s of parseWorkDatesJson(row.work_dates)) {
      keys.add(weekHalfSlotToKey(s))
    }
  }
  return keys
}

export async function upsertWeeklyReportItemDb(input: {
  reportId: string
  itemId?: string | null
  item_type: WeeklyReportItemType
  item_desc: string | null
  work_slots: WeekHalfSlot[]
  file_ids: string[]
}): Promise<{ id: string }> {
  const supabase = await createClient()
  let itemId = input.itemId ?? null
  const workDays = weekHalfSlotsToWorkDays(input.work_slots)
  const workDates = workSlotsToJson(input.work_slots)

  if (itemId) {
    const { error: e0 } = await supabase
      .from('weekly_report_items')
      .update({
        item_type: input.item_type,
        item_desc: input.item_desc,
        work_dates: workDates,
        work_days: workDays,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .eq('report_id', input.reportId)

    if (e0) handleDbError(e0)
  } else {
    const { data: maxRow, error: em } = await supabase
      .from('weekly_report_items')
      .select('sort_order')
      .eq('report_id', input.reportId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (em) handleDbError(em)
    const sortOrder = (maxRow?.sort_order ?? -1) + 1

    const { data: ins, error: e1 } = await supabase
      .from('weekly_report_items')
      .insert({
        report_id: input.reportId,
        item_type: input.item_type,
        item_desc: input.item_desc,
        work_dates: workDates,
        work_days: workDays,
        sort_order: sortOrder,
      })
      .select('id')
      .single()

    if (e1) handleDbError(e1)
    itemId = ins.id
  }

  const { error: eDel } = await supabase
    .from('weekly_report_file_links')
    .delete()
    .eq('report_item_id', itemId)

  if (eDel) handleDbError(eDel)

  if (input.file_ids.length) {
    const { error: eIns } = await supabase
      .from('weekly_report_file_links')
      .insert(
        input.file_ids.map((fid) => ({
          report_item_id: itemId,
          file_id: fid,
        }))
      )

    if (eIns) handleDbError(eIns)
  }

  if (!itemId) {
    throw new Error('weekly_report_items upsert missing id')
  }
  return { id: itemId }
}

export async function deleteWeeklyReportItemDb(input: {
  reportId: string
  itemId: string
}): Promise<void> {
  const supabase = await createClient()

  const { error: e0 } = await supabase
    .from('weekly_report_file_links')
    .delete()
    .eq('report_item_id', input.itemId)

  if (e0) handleDbError(e0)

  const { error: e1 } = await supabase
    .from('weekly_report_items')
    .delete()
    .eq('id', input.itemId)
    .eq('report_id', input.reportId)

  if (e1) handleDbError(e1)
}
