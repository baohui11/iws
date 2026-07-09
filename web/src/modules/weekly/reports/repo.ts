import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  lte,
  ne,
  sql,
} from 'drizzle-orm'
import { getDb } from '@/core/db/client'
import {
  departments,
  projectMembers,
  projects,
  users,
  weeklyReportApprovals,
  weeklyReportItems,
  weeklyReports,
  weeks,
} from '@/core/db/schema'
import { WEEKLY_REPORTS_PAGE_SIZE } from '@/constants/weekly-reports-list'
import {
  compareWeekCode,
  getCurrentWeekCode,
} from '@/modules/weekly/lib/iso-week'
import {
  formatWeekRangeLine,
  formatWeekTitleZh,
  isTodayInWeekRange,
} from '@/modules/weekly/lib/week-display'
import type { ProjectStageValue } from '@/constants/project-stage'
import type {
  MemberProjectOption,
  MyFilledReportRow,
  MyFilledReportsPaged,
  MyFilledReportsParams,
  PmApprovalListPaged,
  PmApprovalListParams,
  PmApprovalListRow,
  WeeklyDashboardRecentProject,
  WeekOption,
} from '../types'

export { WEEKLY_REPORTS_PAGE_SIZE }

async function fetchMemberProjectIds(userId: string): Promise<string[]> {
  const db = getDb()
  const rows = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.userId, userId),
        eq(projectMembers.isActive, true),
        isNull(projectMembers.deletedAt)
      )
    )
  const ids = rows
    .map((r) => r.projectId)
    .filter((id): id is string => id != null)
  return [...new Set(ids)]
}

async function fetchPmProjectIds(userId: string): Promise<string[]> {
  const db = getDb()
  const rows = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.userId, userId),
        eq(projectMembers.projectRole, '项目经理'),
        eq(projectMembers.projectStage, '实施阶段'),
        eq(projectMembers.isActive, true),
        isNull(projectMembers.deletedAt)
      )
    )
  const ids = rows
    .map((r) => r.projectId)
    .filter((id): id is string => id != null)
  return [...new Set(ids)]
}

export async function projectHasPm(projectId: string): Promise<boolean> {
  const db = getDb()
  const rows = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
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

export function mapProjectRowWithDepartment(r: {
  id: string
  projectNo: string | null
  projectName: string | null
  departmentId: string | null
  departmentName: string | null
  projectStage: MemberProjectOption['project_stage']
  availableProjectStages?: ProjectStageValue[]
}): MemberProjectOption {
  return {
    id: r.id,
    project_no: r.projectNo,
    project_name: r.projectName,
    project_stage: r.projectStage,
    available_project_stages: r.availableProjectStages ?? [],
    department_id: r.departmentId,
    department_name: r.departmentName,
  }
}

async function fetchProjectsForFilter(
  projectIds: string[],
  userId?: string
): Promise<MemberProjectOption[]> {
  if (!projectIds.length) return []
  const db = getDb()
  const rows = await db
    .select({
      id: projects.id,
      projectNo: projects.projectNo,
      projectName: projects.projectName,
      projectStage: projects.projectStage,
      departmentId: projects.departmentId,
      departmentName: departments.name,
    })
    .from(projects)
    .leftJoin(departments, eq(projects.departmentId, departments.id))
    .where(
      and(
        inArray(projects.id, projectIds),
        eq(projects.projectStatus, '进行中'),
        isNull(projects.deletedAt),
        eq(projects.isActive, true)
      )
    )
    .orderBy(asc(projects.projectNo))

  const stagesByProject = new Map<string, ProjectStageValue[]>()
  if (userId) {
    const memberRows = await db
      .select({
        projectId: projectMembers.projectId,
        projectStage: projectMembers.projectStage,
      })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.userId, userId),
          inArray(projectMembers.projectId, projectIds),
          eq(projectMembers.isActive, true),
          isNull(projectMembers.deletedAt)
        )
      )
    for (const row of memberRows) {
      if (!row.projectId || !row.projectStage) continue
      const stages = stagesByProject.get(row.projectId) ?? []
      if (!stages.includes(row.projectStage)) stages.push(row.projectStage)
      stagesByProject.set(row.projectId, stages)
    }
  }

  return rows.map((row) =>
    mapProjectRowWithDepartment({
      ...row,
      availableProjectStages: stagesByProject.get(row.id) ?? [],
    })
  )
}

export async function getMemberProjectsForWeeklyFilter(
  userId: string
): Promise<MemberProjectOption[]> {
  const projectIds = await fetchMemberProjectIds(userId)
  return fetchProjectsForFilter(projectIds, userId)
}

export async function getPmProjectsForFilter(
  userId: string
): Promise<MemberProjectOption[]> {
  const projectIds = await fetchPmProjectIds(userId)
  return fetchProjectsForFilter(projectIds)
}

export async function getWeekOptionsUpToCurrent(
  limit = 104
): Promise<WeekOption[]> {
  const db = getDb()
  const today = new Date().toISOString().slice(0, 10)
  const rows = await db
    .select({
      weekCode: weeks.weekCode,
      startDate: weeks.startDate,
      endDate: weeks.endDate,
    })
    .from(weeks)
    .where(lte(weeks.startDate, today))
    .orderBy(desc(weeks.endDate))
    .limit(limit)

  return rows.map((r) => {
    const start = r.startDate ?? null
    const end = r.endDate ?? null
    return {
      week_code: r.weekCode,
      title_zh: formatWeekTitleZh(r.weekCode),
      range_line: formatWeekRangeLine(start, end),
      start_date: start,
      end_date: end,
      is_current: isTodayInWeekRange(start, end),
    }
  })
}

function capWeekCodes(weekCodes: string[]): string[] | null {
  if (!weekCodes.length) return []
  const current = getCurrentWeekCode()
  const capped = weekCodes.filter((w) => compareWeekCode(w, current) <= 0)
  return capped.length ? capped : null
}

export async function getMyFilledReportsWithStats(
  params: MyFilledReportsParams
): Promise<MyFilledReportsPaged> {
  const { userId, weekCodes, projectIds } = params
  const offset = Math.max(0, params.offset ?? 0)
  const limit = Math.min(Math.max(1, params.limit ?? WEEKLY_REPORTS_PAGE_SIZE), 100)

  const memberIds = await fetchMemberProjectIds(userId)
  if (!memberIds.length) return { rows: [], total: 0 }

  const projectScope = projectIds.length
    ? projectIds.filter((id) => memberIds.includes(id))
    : memberIds
  if (!projectScope.length) return { rows: [], total: 0 }

  const cappedWeeks = weekCodes.length ? capWeekCodes(weekCodes) : null
  if (weekCodes.length && cappedWeeks === null) return { rows: [], total: 0 }

  const db = getDb()
  const baseConditions = [
    eq(weeklyReports.userId, userId),
    inArray(weeklyReports.projectId, projectScope),
    ...(cappedWeeks?.length
      ? [inArray(weeklyReports.weekCode, cappedWeeks)]
      : []),
  ]

  const [{ value: totalCount }] = await db
    .select({ value: count() })
    .from(weeklyReports)
    .where(and(...baseConditions))

  const total = totalCount ?? 0
  if (total === 0) return { rows: [], total: 0 }

  const list = await db
    .select({
      id: weeklyReports.id,
      projectId: weeklyReports.projectId,
      weekCode: weeklyReports.weekCode,
      projectStage: weeklyReports.projectStage,
      status: weeklyReports.status,
    })
    .from(weeklyReports)
    .where(and(...baseConditions))
    .orderBy(desc(weeklyReports.weekCode), asc(weeklyReports.projectId))
    .offset(offset)
    .limit(limit)

  if (!list.length) return { rows: [], total }

  const reportIds = list.map((r) => r.id)
  const items = await db
    .select({
      reportId: weeklyReportItems.reportId,
      workDays: weeklyReportItems.workDays,
      itemType: weeklyReportItems.itemType,
    })
    .from(weeklyReportItems)
    .where(inArray(weeklyReportItems.reportId, reportIds))

  const countBy = new Map<string, number>()
  const daysBy = new Map<string, number>()
  for (const it of items) {
    const rid = it.reportId
    countBy.set(rid, (countBy.get(rid) ?? 0) + 1)
    if (it.itemType !== 'work') continue
    const d = it.workDays != null ? Number(it.workDays) : 0
    daysBy.set(rid, (daysBy.get(rid) ?? 0) + d)
  }

  const projIds = [...new Set(list.map((r) => r.projectId))]
  const projRows = await db
    .select({ id: projects.id, projectName: projects.projectName })
    .from(projects)
    .where(inArray(projects.id, projIds))
  const nameBy = new Map(projRows.map((p) => [p.id, p.projectName]))

  const rows: MyFilledReportRow[] = list.map((r) => {
    const td = daysBy.get(r.id) ?? 0
    const th = td * 8
    return {
      id: r.id,
      project_id: r.projectId,
      week_code: r.weekCode,
      project_stage: r.projectStage,
      status: r.status as MyFilledReportRow['status'],
      project_name: nameBy.get(r.projectId) ?? null,
      item_count: countBy.get(r.id) ?? 0,
      total_work_hours: Math.round(th * 10) / 10,
      work_days: Math.round(td * 10) / 10,
    }
  })

  return { rows, total }
}

export async function getPmApprovalList(
  params: PmApprovalListParams
): Promise<PmApprovalListPaged> {
  const { userId, approvalFilter, weekCodes, projectIds } = params
  const offset = Math.max(0, params.offset ?? 0)
  const limit = Math.min(Math.max(1, params.limit ?? WEEKLY_REPORTS_PAGE_SIZE), 100)

  const pmIds = await fetchPmProjectIds(userId)
  if (!pmIds.length) return { rows: [], total: 0 }

  const projectScope = projectIds.length
    ? projectIds.filter((id) => pmIds.includes(id))
    : pmIds
  if (!projectScope.length) return { rows: [], total: 0 }

  const cappedWeeks = weekCodes.length ? capWeekCodes(weekCodes) : null
  if (weekCodes.length && cappedWeeks === null) return { rows: [], total: 0 }

  const db = getDb()
  const conditions = [
    ne(weeklyReports.userId, userId),
    inArray(weeklyReports.projectId, projectScope),
    eq(weeklyReports.projectStage, '实施阶段'),
    inArray(weeklyReports.status, ['pending', 'approved', 'rejected']),
    ...(cappedWeeks?.length
      ? [inArray(weeklyReports.weekCode, cappedWeeks)]
      : []),
  ]

  let list = await db
    .select({
      id: weeklyReports.id,
      userId: weeklyReports.userId,
      projectId: weeklyReports.projectId,
      weekCode: weeklyReports.weekCode,
      projectStage: weeklyReports.projectStage,
      status: weeklyReports.status,
      submitTime: weeklyReports.submitTime,
    })
    .from(weeklyReports)
    .where(and(...conditions))

  if (!list.length) return { rows: [], total: 0 }

  const reportIds = list.map((r) => r.id)
  const submitTimeByReport = new Map(
    list.map((r) => [r.id, r.submitTime ? r.submitTime.toISOString() : null])
  )

  const myApprovals = await db
    .select({
      reportId: weeklyReportApprovals.reportId,
      approvedAt: weeklyReportApprovals.approvedAt,
      createdAt: weeklyReportApprovals.createdAt,
    })
    .from(weeklyReportApprovals)
    .where(
      and(
        eq(weeklyReportApprovals.approverId, userId),
        inArray(weeklyReportApprovals.reportId, reportIds)
      )
    )

  const approvedSet = new Set<string>()
  for (const a of myApprovals) {
    const rid = a.reportId
    const st = submitTimeByReport.get(rid)
    if (!st) continue
    const threshold = new Date(st).getTime()
    if (Number.isNaN(threshold)) continue
    const t = a.approvedAt
      ? new Date(a.approvedAt).getTime()
      : new Date(a.createdAt).getTime()
    if (!Number.isNaN(t) && t >= threshold) {
      approvedSet.add(rid)
    }
  }

  if (approvalFilter === 'pending') {
    list = list.filter((r) => r.status === 'pending')
  } else if (approvalFilter === 'rejected') {
    list = list.filter((r) => r.status === 'rejected')
  } else if (approvalFilter === 'approved') {
    list = list.filter((r) => r.status === 'approved')
  }

  const userIds = [...new Set(list.map((r) => r.userId))]
  const projIds = [...new Set(list.map((r) => r.projectId))]

  const userRows = userIds.length
    ? await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(inArray(users.id, userIds))
    : []
  const userName = new Map(
    userRows.map((u) => [u.id, u.name?.trim() || '—'])
  )

  const projRows = projIds.length
    ? await db
        .select({ id: projects.id, projectName: projects.projectName })
        .from(projects)
        .where(inArray(projects.id, projIds))
    : []
  const projName = new Map(projRows.map((p) => [p.id, p.projectName]))

  const out: PmApprovalListRow[] = list.map((r) => ({
    id: r.id,
    project_id: r.projectId,
    week_code: r.weekCode,
    project_stage: r.projectStage,
    status: r.status as PmApprovalListRow['status'],
    project_name: projName.get(r.projectId) ?? null,
    author_name: userName.get(r.userId) ?? '—',
    author_id: r.userId,
    has_my_approval: approvedSet.has(r.id),
  }))

  out.sort((a, b) => {
    const cw = compareWeekCode(b.week_code, a.week_code)
    if (cw !== 0) return cw
    return (a.project_name ?? '').localeCompare(b.project_name ?? '', 'zh-CN')
  })

  const total = out.length
  const slice = out.slice(offset, offset + limit)
  return { rows: slice, total }
}

export async function getPmPendingApprovalCount(
  userId: string
): Promise<number> {
  const pmIds = await fetchPmProjectIds(userId)
  if (!pmIds.length) return 0

  const db = getDb()
  const [{ value }] = await db
    .select({ value: count() })
    .from(weeklyReports)
    .where(
      and(
        ne(weeklyReports.userId, userId),
        inArray(weeklyReports.projectId, pmIds),
        eq(weeklyReports.projectStage, '实施阶段'),
        eq(weeklyReports.status, 'pending')
      )
    )
  return value ?? 0
}

export async function isPmOnAnyProject(userId: string): Promise<boolean> {
  const pmIds = await fetchPmProjectIds(userId)
  return pmIds.length > 0
}

export async function getPmProjectIdsForUser(userId: string): Promise<string[]> {
  return fetchPmProjectIds(userId)
}

export async function getSubmittedWorkDaysForWeek(
  userId: string,
  weekCode: string
): Promise<number> {
  const db = getDb()
  const [{ value }] = await db
    .select({
      value: sql<string | null>`coalesce(sum(${weeklyReportItems.workDays}), 0)`,
    })
    .from(weeklyReports)
    .innerJoin(
      weeklyReportItems,
      eq(weeklyReportItems.reportId, weeklyReports.id)
    )
    .where(
      and(
        eq(weeklyReports.userId, userId),
        eq(weeklyReports.weekCode, weekCode),
        inArray(weeklyReports.status, ['pending', 'approved']),
        eq(weeklyReportItems.itemType, 'work')
      )
    )

  return Math.round(Number(value ?? 0) * 10) / 10
}

export async function getRecentDashboardProjects(input: {
  userId: string
  weekCodes: string[]
  limit?: number
}): Promise<WeeklyDashboardRecentProject[]> {
  const limit = Math.min(Math.max(1, input.limit ?? 4), 8)
  if (!input.weekCodes.length) return []
  const db = getDb()
  const reportRows = await db
    .select({
      projectId: weeklyReports.projectId,
      projectStage: weeklyReports.projectStage,
      weekCode: weeklyReports.weekCode,
      status: weeklyReports.status,
      updatedAt: weeklyReports.updatedAt,
      projectName: projects.projectName,
      projectStatus: projects.projectStatus,
      projectActive: projects.isActive,
      projectDeletedAt: projects.deletedAt,
    })
    .from(weeklyReports)
    .innerJoin(projects, eq(projects.id, weeklyReports.projectId))
    .where(
      and(
        eq(weeklyReports.userId, input.userId),
        inArray(weeklyReports.weekCode, input.weekCodes)
      )
    )
    .orderBy(desc(weeklyReports.updatedAt))
    .limit(80)

  if (!reportRows.length) return []

  const projectIds = [...new Set(reportRows.map((row) => row.projectId))]
  const memberRows = await db
    .select({
      projectId: projectMembers.projectId,
      projectStage: projectMembers.projectStage,
    })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.userId, input.userId),
        inArray(projectMembers.projectId, projectIds),
        eq(projectMembers.isActive, true),
        isNull(projectMembers.deletedAt)
      )
    )

  const activeStagesByProject = new Map<string, ProjectStageValue[]>()
  for (const row of memberRows) {
    if (!row.projectId || !row.projectStage) continue
    const stages = activeStagesByProject.get(row.projectId) ?? []
    if (!stages.includes(row.projectStage)) stages.push(row.projectStage)
    activeStagesByProject.set(row.projectId, stages)
  }

  const byProject = new Map<string, WeeklyDashboardRecentProject>()
  for (const row of reportRows) {
    const existing = byProject.get(row.projectId)
    const activeStages = activeStagesByProject.get(row.projectId) ?? []
    const projectUsable =
      row.projectDeletedAt == null && row.projectActive && activeStages.length > 0
    const canUploadFile = projectUsable
    const canCreateReport = projectUsable && row.projectStatus === '进行中'
    const actionStage = activeStages.includes(row.projectStage)
      ? row.projectStage
      : (activeStages[0] ?? null)

    if (!existing) {
      byProject.set(row.projectId, {
        project_id: row.projectId,
        project_name: row.projectName,
        stages: [row.projectStage],
        action_stage: actionStage,
        latest_week_code: row.weekCode,
        latest_status: row.status as WeeklyDashboardRecentProject['latest_status'],
        can_create_report: canCreateReport,
        can_upload_file: canUploadFile,
      })
    } else if (!existing.stages.includes(row.projectStage)) {
      existing.stages.push(row.projectStage)
    }
  }

  return [...byProject.values()].slice(0, limit)
}
