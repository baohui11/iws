import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  ne,
} from 'drizzle-orm'
import { getDb } from '@/core/db/client'
import {
  files,
  projectMembers,
  projects,
  users,
  weeklyReportApprovals,
  weeklyReportFileLinks,
  weeklyReportItems,
  weeklyReports,
  weeks,
} from '@/core/db/schema'
import { isWeeklyReportEditableStatus } from '@/constants/weekly-report-status'
import type { WeeklyReportStatus } from '@/constants/weekly-report-status'
import {
  PROJECT_STAGE_SALES,
  type ProjectStageValue,
} from '@/constants/project-stage'
import { nextWeekRangeAfterWeekEnd } from '@/modules/weekly/lib/week-report-dates'
import {
  parseWeekHalfSlotKey,
  parseWorkDatesJson,
  weekHalfSlotToKey,
  weekHalfSlotsToWorkDays,
  workSlotsToJson,
  type WeekHalfSlot,
} from '@/modules/weekly/lib/weekly-report-work-slots'
import { isProjectWeekExempt } from '../exemptions/repo'
import type {
  WeeklyReportDetailPayload,
  WeeklyReportEditorItem,
  WeeklyReportEditorPayload,
  WeeklyReportEditorProject,
  WeeklyReportFilePickRow,
  WeeklyReportWeekBounds,
  WeeklyReportItemType,
} from '../types'

function toIso(d: Date | string | null | undefined): string | null {
  if (d == null) return null
  return d instanceof Date ? d.toISOString() : d
}

function weekHalfSlotKeysToSlots(keys: Set<string>): WeekHalfSlot[] {
  const out: WeekHalfSlot[] = []
  for (const k of keys) {
    const p = parseWeekHalfSlotKey(k)
    if (p) out.push(p)
  }
  return out
}

export async function getWeekBoundsByCode(
  weekCode: string
): Promise<WeeklyReportWeekBounds | null> {
  const db = getDb()
  const rows = await db
    .select({
      weekCode: weeks.weekCode,
      startDate: weeks.startDate,
      endDate: weeks.endDate,
      deadline: weeks.deadline,
    })
    .from(weeks)
    .where(eq(weeks.weekCode, weekCode))
    .limit(1)

  const data = rows[0]
  if (!data?.startDate || !data?.endDate) return null
  return {
    week_code: data.weekCode,
    start_date: data.startDate,
    end_date: data.endDate,
    deadline: toIso(data.deadline),
  }
}

export async function isUserProjectMember(
  userId: string,
  projectId: string,
  projectStage?: ProjectStageValue
): Promise<boolean> {
  const db = getDb()
  const conditions = [
    eq(projectMembers.userId, userId),
    eq(projectMembers.projectId, projectId),
    eq(projectMembers.isActive, true),
    isNull(projectMembers.deletedAt),
  ]
  if (projectStage) {
    conditions.push(eq(projectMembers.projectStage, projectStage))
  }
  const rows = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(and(...conditions))
    .limit(1)
  return rows.length > 0
}

export async function isUserImplementationProjectManager(
  userId: string,
  projectId: string
): Promise<boolean> {
  const db = getDb()
  const rows = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.userId, userId),
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.projectRole, '项目经理'),
        eq(projectMembers.projectStage, '实施阶段'),
        eq(projectMembers.isActive, true),
        isNull(projectMembers.deletedAt)
      )
    )
    .limit(1)
  return rows.length > 0
}

async function fetchProjectBrief(
  projectId: string
): Promise<WeeklyReportEditorProject | null> {
  const db = getDb()
  const rows = await db
    .select({
      id: projects.id,
      projectNo: projects.projectNo,
      projectName: projects.projectName,
    })
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .limit(1)

  const data = rows[0]
  if (!data) return null
  return {
    id: data.id,
    project_no: data.projectNo,
    project_name: data.projectName,
  }
}

export async function getWeeklyReportMetaForUserWeek(
  userId: string,
  projectId: string,
  weekCode: string,
  projectStage: ProjectStageValue
): Promise<{ id: string; status: WeeklyReportStatus } | null> {
  const db = getDb()
  const rows = await db
    .select({ id: weeklyReports.id, status: weeklyReports.status })
    .from(weeklyReports)
    .where(
      and(
        eq(weeklyReports.userId, userId),
        eq(weeklyReports.projectId, projectId),
        eq(weeklyReports.weekCode, weekCode),
        eq(weeklyReports.projectStage, projectStage)
      )
    )
    .limit(1)

  const data = rows[0]
  if (!data) return null
  return { id: data.id, status: data.status as WeeklyReportStatus }
}

export async function getOrCreateDraftReport(
  userId: string,
  projectId: string,
  weekCode: string,
  projectStage: ProjectStageValue
): Promise<{ id: string }> {
  const db = getDb()
  const existing = await db
    .select({ id: weeklyReports.id })
    .from(weeklyReports)
    .where(
      and(
        eq(weeklyReports.userId, userId),
        eq(weeklyReports.projectId, projectId),
        eq(weeklyReports.weekCode, weekCode),
        eq(weeklyReports.projectStage, projectStage)
      )
    )
    .limit(1)

  if (existing[0]?.id) return { id: existing[0].id }

  const created = await db
    .insert(weeklyReports)
    .values({
      userId,
      projectId,
      weekCode,
      projectStage,
      status: 'draft',
    })
    .returning({ id: weeklyReports.id })

  return { id: created[0].id }
}

function mapRawRowsToEditorItems(
  list: {
    id: string
    itemDesc: string | null
    itemType: WeeklyReportItemType
    workDates: unknown
    workDays: string | null
    sortOrder: number | null
  }[],
  filesByItem: Map<string, { id: string; file_name: string }[]>
): WeeklyReportEditorItem[] {
  return list.map((it) => {
    const fs = filesByItem.get(it.id) ?? []
    const slots = parseWorkDatesJson(it.workDates as Parameters<typeof parseWorkDatesJson>[0])
    const wd =
      it.workDays != null
        ? Number(it.workDays)
        : weekHalfSlotsToWorkDays(slots)
    return {
      id: it.id,
      item_type: it.itemType,
      item_desc: it.itemDesc,
      work_slots: slots,
      work_days: Number.isFinite(wd) ? wd : null,
      sort_order: it.sortOrder ?? 0,
      file_ids: fs.map((x) => x.id),
      files: fs,
    }
  })
}

async function buildFilesByItemMap(
  itemIds: string[]
): Promise<Map<string, { id: string; file_name: string }[]>> {
  const filesByItem = new Map<string, { id: string; file_name: string }[]>()
  if (!itemIds.length) return filesByItem

  const db = getDb()
  const links = await db
    .select({
      reportItemId: weeklyReportFileLinks.reportItemId,
      fileId: weeklyReportFileLinks.fileId,
    })
    .from(weeklyReportFileLinks)
    .where(inArray(weeklyReportFileLinks.reportItemId, itemIds))

  const fileIds = [...new Set(links.map((l) => l.fileId))]
  const fileMeta = new Map<string, { file_name: string }>()
  if (fileIds.length) {
    const fileRows = await db
      .select({ id: files.id, fileName: files.fileName })
      .from(files)
      .where(inArray(files.id, fileIds))

    for (const f of fileRows) {
      fileMeta.set(f.id, { file_name: f.fileName })
    }
  }

  for (const l of links) {
    const meta = fileMeta.get(l.fileId)
    if (!meta) continue
    const arr = filesByItem.get(l.reportItemId) ?? []
    arr.push({ id: l.fileId, file_name: meta.file_name })
    filesByItem.set(l.reportItemId, arr)
  }

  return filesByItem
}

async function loadItemsWithFiles(
  reportId: string
): Promise<WeeklyReportEditorItem[]> {
  const db = getDb()
  const list = await db
    .select({
      id: weeklyReportItems.id,
      itemDesc: weeklyReportItems.itemDesc,
      itemType: weeklyReportItems.itemType,
      workDates: weeklyReportItems.workDates,
      workDays: weeklyReportItems.workDays,
      sortOrder: weeklyReportItems.sortOrder,
    })
    .from(weeklyReportItems)
    .where(eq(weeklyReportItems.reportId, reportId))
    .orderBy(asc(weeklyReportItems.sortOrder))

  if (!list.length) return []

  const filesByItem = await buildFilesByItemMap(list.map((i) => i.id))
  return mapRawRowsToEditorItems(list, filesByItem)
}

async function loadItemsWithFilesForReportIds(
  reportIds: string[]
): Promise<Map<string, WeeklyReportEditorItem[]>> {
  const out = new Map<string, WeeklyReportEditorItem[]>()
  if (!reportIds.length) return out

  const db = getDb()
  const list = await db
    .select({
      id: weeklyReportItems.id,
      reportId: weeklyReportItems.reportId,
      itemDesc: weeklyReportItems.itemDesc,
      itemType: weeklyReportItems.itemType,
      workDates: weeklyReportItems.workDates,
      workDays: weeklyReportItems.workDays,
      sortOrder: weeklyReportItems.sortOrder,
    })
    .from(weeklyReportItems)
    .where(inArray(weeklyReportItems.reportId, reportIds))
    .orderBy(asc(weeklyReportItems.reportId), asc(weeklyReportItems.sortOrder))

  if (!list.length) return out

  const filesByItem = await buildFilesByItemMap(list.map((i) => i.id))

  const byReport = new Map<string, typeof list>()
  for (const row of list) {
    const rid = row.reportId
    if (!byReport.has(rid)) byReport.set(rid, [])
    byReport.get(rid)!.push(row)
  }

  for (const [rid, group] of byReport) {
    out.set(rid, mapRawRowsToEditorItems(group, filesByItem))
  }
  return out
}

/** 供项目「周详情」页聚合多人工作事项 */
export async function loadWeeklyReportItemsForReportIds(
  reportIds: string[]
): Promise<Map<string, WeeklyReportEditorItem[]>> {
  return loadItemsWithFilesForReportIds(reportIds)
}

export async function loadWeeklyReportEditorPayload(
  userId: string,
  projectId: string,
  weekCode: string,
  projectStage: ProjectStageValue
): Promise<WeeklyReportEditorPayload | null> {
  const week = await getWeekBoundsByCode(weekCode)
  if (!week) return null

  const member = await isUserProjectMember(userId, projectId, projectStage)
  if (!member) return null

  const project = await fetchProjectBrief(projectId)
  if (!project) return null

  if (await isProjectWeekExempt(projectId, weekCode)) {
    return null
  }

  const { id: reportId } = await getOrCreateDraftReport(
    userId,
    projectId,
    weekCode,
    projectStage
  )

  const db = getDb()
  const reportRows = await db
    .select({
      id: weeklyReports.id,
      status: weeklyReports.status,
      userId: weeklyReports.userId,
      projectId: weeklyReports.projectId,
      weekCode: weeklyReports.weekCode,
      projectStage: weeklyReports.projectStage,
      isOverdue: weeklyReports.isOverdue,
    })
    .from(weeklyReports)
    .where(eq(weeklyReports.id, reportId))
    .limit(1)

  const report = reportRows[0]
  if (!report) return null
  if (report.userId !== userId) return null
  if (!isWeeklyReportEditableStatus(report.status as WeeklyReportStatus)) {
    return null
  }

  const items = await loadItemsWithFiles(reportId)

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
      status: report.status as WeeklyReportStatus,
      user_id: report.userId,
      project_id: report.projectId,
      week_code: report.weekCode,
      project_stage: report.projectStage,
      is_overdue: !!report.isOverdue,
    },
    week,
    next_week: nextWeekRangeAfterWeekEnd(week.end_date),
    project,
    items,
    used_slots_other_reports_work: weekHalfSlotKeysToSlots(workKeysOther),
    used_slots_other_reports_plan: weekHalfSlotKeysToSlots(planKeysOther),
  }
}

export async function listWeeklyReportFilesForPicker(
  projectId: string,
  weekStartDate: string,
  projectStage: ProjectStageValue
): Promise<WeeklyReportFilePickRow[]> {
  const db = getDb()
  const startIso = `${weekStartDate}T00:00:00.000Z`
  const isSalesStage = projectStage === PROJECT_STAGE_SALES

  const rows = await db
    .select({
      id: files.id,
      fileName: files.fileName,
      createdAt: files.createdAt,
      versionLabel: files.versionLabel,
      isLatest: files.isLatest,
      isDeliverable: files.isDeliverable,
      salesFileTag: files.salesFileTag,
      fileSource: files.fileSource,
    })
    .from(files)
    .where(
      and(
        eq(files.projectId, projectId),
        eq(files.projectStage, projectStage),
        eq(files.isDeliverable, !isSalesStage),
        gte(files.createdAt, new Date(startIso))
      )
    )
    .orderBy(desc(files.createdAt))

  return rows.map((r) => ({
    id: r.id,
    file_name: r.fileName,
    created_at: toIso(r.createdAt) ?? '',
    version_label: r.versionLabel,
    is_latest: r.isLatest ?? false,
    is_deliverable: r.isDeliverable ?? false,
    sales_file_tag: r.salesFileTag,
    file_source: r.fileSource,
  }))
}

export async function verifyFilesLinkableToWeeklyItem(
  fileIds: string[],
  projectId: string,
  projectStage: ProjectStageValue,
  weekStartDate: string
): Promise<boolean> {
  if (!fileIds.length) return true

  const db = getDb()
  const startIso = `${weekStartDate}T00:00:00.000Z`
  const isSalesStage = projectStage === PROJECT_STAGE_SALES
  const rows = await db
    .select({ id: files.id })
    .from(files)
    .where(
      and(
        inArray(files.id, fileIds),
        eq(files.projectId, projectId),
        eq(files.projectStage, projectStage),
        eq(files.isDeliverable, !isSalesStage),
        gte(files.createdAt, new Date(startIso))
      )
    )

  const ok = new Set(rows.map((r) => r.id))
  return fileIds.every((id) => ok.has(id))
}

export async function loadWeeklyReportDetail(
  reportId: string
): Promise<WeeklyReportDetailPayload | null> {
  const db = getDb()
  const reportRows = await db
    .select({
      id: weeklyReports.id,
      status: weeklyReports.status,
      userId: weeklyReports.userId,
      projectId: weeklyReports.projectId,
      weekCode: weeklyReports.weekCode,
      projectStage: weeklyReports.projectStage,
      submitTime: weeklyReports.submitTime,
      createdAt: weeklyReports.createdAt,
      isOverdue: weeklyReports.isOverdue,
    })
    .from(weeklyReports)
    .where(eq(weeklyReports.id, reportId))
    .limit(1)

  const report = reportRows[0]
  if (!report) return null

  const week = await getWeekBoundsByCode(report.weekCode)
  if (!week) return null

  const project = await fetchProjectBrief(report.projectId)
  if (!project) return null

  const authorRows = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, report.userId))
    .limit(1)

  const items = await loadItemsWithFiles(reportId)

  let rejectReason: string | null = null
  if (report.status === 'rejected') {
    const rejRows = await db
      .select({ rejectReason: weeklyReportApprovals.rejectReason })
      .from(weeklyReportApprovals)
      .where(
        and(
          eq(weeklyReportApprovals.reportId, reportId),
          eq(weeklyReportApprovals.action, 'reject')
        )
      )
      .orderBy(
        desc(weeklyReportApprovals.approvedAt),
        desc(weeklyReportApprovals.createdAt)
      )
      .limit(1)

    const raw = rejRows[0]?.rejectReason?.trim()
    rejectReason = raw ? raw : null
  }

  return {
    report: {
      id: report.id,
      status: report.status as WeeklyReportStatus,
      user_id: report.userId,
      project_id: report.projectId,
      week_code: report.weekCode,
      project_stage: report.projectStage,
      submit_time: toIso(report.submitTime),
      created_at: toIso(report.createdAt)!,
      is_overdue: !!report.isOverdue,
    },
    week,
    next_week: nextWeekRangeAfterWeekEnd(week.end_date),
    project,
    author_name: authorRows[0]?.name?.trim() || null,
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

  const db = getDb()
  const rows = await db
    .select({
      action: weeklyReportApprovals.action,
      rejectReason: weeklyReportApprovals.rejectReason,
      approvedAt: weeklyReportApprovals.approvedAt,
      createdAt: weeklyReportApprovals.createdAt,
    })
    .from(weeklyReportApprovals)
    .where(
      and(
        eq(weeklyReportApprovals.reportId, reportId),
        eq(weeklyReportApprovals.approverId, approverId)
      )
    )
    .orderBy(
      desc(weeklyReportApprovals.approvedAt),
      desc(weeklyReportApprovals.createdAt)
    )

  const threshold = new Date(submitTime).getTime()
  if (Number.isNaN(threshold)) return null

  for (const r of rows) {
    const t =
      r.approvedAt != null
        ? new Date(r.approvedAt).getTime()
        : new Date(r.createdAt).getTime()
    if (!Number.isNaN(t) && t >= threshold) {
      return {
        action: r.action as 'approve' | 'reject',
        reject_reason: r.rejectReason,
        approved_at: toIso(r.approvedAt),
      }
    }
  }
  return null
}

/**
 * 审批通过/驳回：先更新 `weekly_reports`（仅 action 层已校验 PM），再写 `weekly_report_approvals`。
 */
export async function applyWeeklyReportApprovalDb(input: {
  reportId: string
  approverId: string
  decision: 'approve' | 'reject'
  rejectReason: string | null
}): Promise<{ applied: boolean }> {
  const db = getDb()
  const now = new Date()
  const newStatus = input.decision === 'approve' ? 'approved' : 'rejected'

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(weeklyReports)
      .set({ status: newStatus, updatedAt: now })
      .where(
        and(
          eq(weeklyReports.id, input.reportId),
          eq(weeklyReports.status, 'pending')
        )
      )
      .returning({ id: weeklyReports.id })

    if (!updated.length) return { applied: false }

    await tx.insert(weeklyReportApprovals).values({
      reportId: input.reportId,
      approverId: input.approverId,
      action: input.decision,
      rejectReason: input.decision === 'reject' ? input.rejectReason : null,
      approvedAt: now,
      isOverdue: false,
    })

    return { applied: true }
  })
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
  const db = getDb()
  const reportRows = await db
    .select({ id: weeklyReports.id })
    .from(weeklyReports)
    .where(
      and(
        eq(weeklyReports.userId, userId),
        eq(weeklyReports.weekCode, weekCode),
        ne(weeklyReports.id, excludeReportId)
      )
    )

  const reportIds = reportRows.map((r) => r.id).filter(Boolean)
  if (!reportIds.length) return new Set()

  const itemRows = await db
    .select({ workDates: weeklyReportItems.workDates })
    .from(weeklyReportItems)
    .where(
      and(
        eq(weeklyReportItems.itemType, itemType),
        inArray(weeklyReportItems.reportId, reportIds)
      )
    )

  const keys = new Set<string>()
  for (const row of itemRows) {
    for (const s of parseWorkDatesJson(
      row.workDates as Parameters<typeof parseWorkDatesJson>[0]
    )) {
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
  const db = getDb()
  const rows = await db
    .select({
      id: weeklyReportItems.id,
      workDates: weeklyReportItems.workDates,
    })
    .from(weeklyReportItems)
    .where(
      and(
        eq(weeklyReportItems.reportId, reportId),
        eq(weeklyReportItems.itemType, itemType)
      )
    )

  const keys = new Set<string>()
  for (const row of rows) {
    if (excludeItemId && row.id === excludeItemId) continue
    for (const s of parseWorkDatesJson(
      row.workDates as Parameters<typeof parseWorkDatesJson>[0]
    )) {
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
  const db = getDb()
  let itemId = input.itemId ?? null
  const workDays = weekHalfSlotsToWorkDays(input.work_slots)
  const workDates = workSlotsToJson(input.work_slots)
  const now = new Date()

  if (itemId) {
    await db
      .update(weeklyReportItems)
      .set({
        itemType: input.item_type,
        itemDesc: input.item_desc,
        workDates,
        workDays: String(workDays),
        updatedAt: now,
      })
      .where(
        and(
          eq(weeklyReportItems.id, itemId),
          eq(weeklyReportItems.reportId, input.reportId)
        )
      )
  } else {
    const maxRows = await db
      .select({ sortOrder: weeklyReportItems.sortOrder })
      .from(weeklyReportItems)
      .where(eq(weeklyReportItems.reportId, input.reportId))
      .orderBy(desc(weeklyReportItems.sortOrder))
      .limit(1)

    const sortOrder = (maxRows[0]?.sortOrder ?? -1) + 1

    const inserted = await db
      .insert(weeklyReportItems)
      .values({
        reportId: input.reportId,
        itemType: input.item_type,
        itemDesc: input.item_desc,
        workDates,
        workDays: String(workDays),
        sortOrder,
      })
      .returning({ id: weeklyReportItems.id })

    itemId = inserted[0].id
  }

  await db
    .delete(weeklyReportFileLinks)
    .where(eq(weeklyReportFileLinks.reportItemId, itemId!))

  if (input.file_ids.length) {
    await db.insert(weeklyReportFileLinks).values(
      input.file_ids.map((fid) => ({
        reportItemId: itemId!,
        fileId: fid,
      }))
    )
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
  const db = getDb()

  await db
    .delete(weeklyReportFileLinks)
    .where(eq(weeklyReportFileLinks.reportItemId, input.itemId))

  await db
    .delete(weeklyReportItems)
    .where(
      and(
        eq(weeklyReportItems.id, input.itemId),
        eq(weeklyReportItems.reportId, input.reportId)
      )
    )
}

export async function getReportForEdit(reportId: string): Promise<{
  id: string
  user_id: string
  status: WeeklyReportStatus
  project_id: string
  week_code: string
  project_stage: ProjectStageValue
} | null> {
  const db = getDb()
  const rows = await db
    .select({
      id: weeklyReports.id,
      userId: weeklyReports.userId,
      status: weeklyReports.status,
      projectId: weeklyReports.projectId,
      weekCode: weeklyReports.weekCode,
      projectStage: weeklyReports.projectStage,
    })
    .from(weeklyReports)
    .where(eq(weeklyReports.id, reportId))
    .limit(1)

  const r = rows[0]
  if (!r) return null
  return {
    id: r.id,
    user_id: r.userId,
    status: r.status as WeeklyReportStatus,
    project_id: r.projectId,
    week_code: r.weekCode,
    project_stage: r.projectStage,
  }
}

export async function deletePlanItemsDb(reportId: string): Promise<void> {
  const db = getDb()
  await db
    .delete(weeklyReportItems)
    .where(
      and(
        eq(weeklyReportItems.reportId, reportId),
        eq(weeklyReportItems.itemType, 'plan')
      )
    )
}

export async function countPlanItemsDb(reportId: string): Promise<number> {
  const db = getDb()
  const [{ value }] = await db
    .select({ value: count() })
    .from(weeklyReportItems)
    .where(
      and(
        eq(weeklyReportItems.reportId, reportId),
        eq(weeklyReportItems.itemType, 'plan')
      )
    )
  return value ?? 0
}

export async function countWorkItemsDb(reportId: string): Promise<number> {
  const db = getDb()
  const [{ value }] = await db
    .select({ value: count() })
    .from(weeklyReportItems)
    .where(
      and(
        eq(weeklyReportItems.reportId, reportId),
        eq(weeklyReportItems.itemType, 'work')
      )
    )
  return value ?? 0
}

export async function submitWeeklyReportDb(input: {
  reportId: string
  userId: string
  nextStatus: 'pending' | 'approved'
  submitOverdue: boolean
}): Promise<boolean> {
  const db = getDb()
  const now = new Date()
  const updated = await db
    .update(weeklyReports)
    .set({
      status: input.nextStatus,
      submitTime: now,
      updatedAt: now,
      isOverdue: input.submitOverdue,
    })
    .where(
      and(
        eq(weeklyReports.id, input.reportId),
        eq(weeklyReports.userId, input.userId),
        inArray(weeklyReports.status, ['draft', 'rejected', 'withdrawn'])
      )
    )
    .returning({ id: weeklyReports.id })

  return updated.length > 0
}

export async function withdrawWeeklyReportDb(input: {
  reportId: string
  userId: string
  since: Date
}): Promise<boolean> {
  const db = getDb()
  const now = new Date()
  const updated = await db
    .update(weeklyReports)
    .set({
      status: 'withdrawn',
      updatedAt: now,
    })
    .where(
      and(
        eq(weeklyReports.id, input.reportId),
        eq(weeklyReports.userId, input.userId),
        inArray(weeklyReports.status, ['pending', 'approved']),
        gte(weeklyReports.submitTime, input.since)
      )
    )
    .returning({ id: weeklyReports.id })

  return updated.length > 0
}

export async function deleteWeeklyReportDb(input: {
  reportId: string
  userId: string
}): Promise<boolean> {
  const db = getDb()
  const reports = await db
    .select({ id: weeklyReports.id })
    .from(weeklyReports)
    .where(
      and(
        eq(weeklyReports.id, input.reportId),
        eq(weeklyReports.userId, input.userId),
        inArray(weeklyReports.status, ['draft', 'withdrawn'])
      )
    )
    .limit(1)
  if (!reports.length) return false

  const items = await db
    .select({ id: weeklyReportItems.id })
    .from(weeklyReportItems)
    .where(eq(weeklyReportItems.reportId, input.reportId))
  const itemIds = items.map((item) => item.id)

  if (itemIds.length) {
    await db
      .delete(weeklyReportFileLinks)
      .where(inArray(weeklyReportFileLinks.reportItemId, itemIds))
  }
  await db
    .delete(weeklyReportItems)
    .where(eq(weeklyReportItems.reportId, input.reportId))
  await db
    .delete(weeklyReportApprovals)
    .where(eq(weeklyReportApprovals.reportId, input.reportId))
  const deleted = await db
    .delete(weeklyReports)
    .where(eq(weeklyReports.id, input.reportId))
    .returning({ id: weeklyReports.id })

  return deleted.length > 0
}
