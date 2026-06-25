import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, ne, or } from 'drizzle-orm'
import { getDb } from '@/core/db/client'
import {
  files,
  projectMembers,
  projects,
  projectWeekExemptions,
  users,
  weeklyReportApprovals,
  weeklyReportItems,
  weeklyReports,
  weeks,
} from '@/core/db/schema'
import { WEEKLY_REPORT_STATUS_LABEL } from '@/constants/weekly-report-status'
import { compareWeekCode } from '@/modules/weekly/lib/iso-week'
import { getDepartmentIdsForListFilter } from '@/modules/org/departments/repo'
import type {
  WeeklyDeptByPersonRow,
  WeeklyDeptByProjectRow,
  WeeklyDeptDetailRow,
} from '../types'

type WeeklyReportStatus = 'draft' | 'pending' | 'approved' | 'rejected'

function escapeForILike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function weekCoveredByExemptions(
  weekCode: string,
  rows: { startWeekCode: string; endWeekCode: string | null }[]
): boolean {
  const w = weekCode.trim()
  for (const row of rows) {
    const start = row.startWeekCode?.trim() ?? ''
    const end = (row.endWeekCode?.trim() || start) as string
    if (!start) continue
    if (compareWeekCode(w, start) >= 0 && compareWeekCode(w, end) <= 0) {
      return true
    }
  }
  return false
}

function hoursToWorkDays(hours: number): number {
  if (!Number.isFinite(hours) || hours <= 0) return 0
  return Math.round((hours / 8) * 10) / 10
}

export interface WeeklyDeptStatsParams {
  departmentId: string
  weekCode: string
  personNameKeyword?: string | null
  projectKeyword?: string | null
}

async function getProjectIdsInDepartmentScope(departmentId: string): Promise<string[]> {
  const db = getDb()
  const deptIds = await getDepartmentIdsForListFilter(departmentId)
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(inArray(projects.departmentId, deptIds), isNull(projects.deletedAt)))

  return rows.map((r) => r.id).filter(Boolean)
}

async function getWeekDateRange(weekCode: string): Promise<{ start: string; end: string } | null> {
  const db = getDb()
  const rows = await db
    .select({ startDate: weeks.startDate, endDate: weeks.endDate })
    .from(weeks)
    .where(eq(weeks.weekCode, weekCode.trim()))
    .limit(1)

  const row = rows[0]
  const s = row?.startDate
  const e = row?.endDate
  if (!s || !e) return null
  return { start: String(s), end: String(e) }
}

export async function getWeeklyDeptByPerson(
  params: WeeklyDeptStatsParams
): Promise<WeeklyDeptByPersonRow[]> {
  const db = getDb()
  const weekCode = params.weekCode.trim()
  const deptIds = await getDepartmentIdsForListFilter(params.departmentId)
  let projectIds = await getProjectIdsInDepartmentScope(params.departmentId)
  if (!projectIds.length) return []

  const pk = params.projectKeyword?.trim()
  if (pk) {
    const k = `%${escapeForILike(pk)}%`
    const matchRows = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          inArray(projects.id, projectIds),
          or(ilike(projects.projectName, k), ilike(projects.projectNo, k))
        )
      )
    projectIds = matchRows.map((r) => r.id)
    if (!projectIds.length) return []
  }

  const dateRange = await getWeekDateRange(weekCode)
  if (!dateRange) return []

  const userConditions = [
    inArray(users.departmentId, deptIds),
    isNull(users.deletedAt),
  ]
  const kw = params.personNameKeyword?.trim()
  if (kw) {
    userConditions.push(ilike(users.name, `%${escapeForILike(kw)}%`))
  }

  const userRows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(...userConditions))
    .orderBy(asc(users.name))

  const pmRows = await db
    .select({ userId: projectMembers.userId, projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(and(inArray(projectMembers.projectId, projectIds), isNull(projectMembers.deletedAt)))

  const userHasDeptProject = new Set<string>()
  for (const r of pmRows) {
    if (r.userId && r.projectId && projectIds.includes(r.projectId)) {
      userHasDeptProject.add(r.userId)
    }
  }

  const reportRows = await db
    .select({
      id: weeklyReports.id,
      userId: weeklyReports.userId,
      projectId: weeklyReports.projectId,
      status: weeklyReports.status,
      createdAt: weeklyReports.createdAt,
    })
    .from(weeklyReports)
    .where(
      and(
        eq(weeklyReports.weekCode, weekCode),
        inArray(weeklyReports.projectId, projectIds),
        ne(weeklyReports.status, 'draft')
      )
    )

  const reportIds = reportRows.map((r) => r.id)
  const hoursByReport = new Map<string, number>()
  if (reportIds.length) {
    const items = await db
      .select({
        reportId: weeklyReportItems.reportId,
        workDays: weeklyReportItems.workDays,
        itemType: weeklyReportItems.itemType,
      })
      .from(weeklyReportItems)
      .where(inArray(weeklyReportItems.reportId, reportIds))

    for (const it of items) {
      if (it.itemType !== 'work') continue
      const rid = it.reportId
      const d = it.workDays != null ? Number(it.workDays) : 0
      hoursByReport.set(rid, (hoursByReport.get(rid) ?? 0) + d * 8)
    }
  }

  const reportsByUser = new Map<string, typeof reportRows>()
  for (const rep of reportRows) {
    const list = reportsByUser.get(rep.userId) ?? []
    list.push(rep)
    reportsByUser.set(rep.userId, list)
  }

  const fileRows = await db
    .select({
      uploaderId: files.uploaderId,
    })
    .from(files)
    .where(
      and(
        inArray(files.projectId, projectIds),
        gte(files.createdAt, new Date(`${dateRange.start}T00:00:00`)),
        lte(files.createdAt, new Date(`${dateRange.end}T23:59:59.999`))
      )
    )

  const fileCountByUser = new Map<string, number>()
  for (const f of fileRows) {
    const uid = f.uploaderId
    if (!uid) continue
    fileCountByUser.set(uid, (fileCountByUser.get(uid) ?? 0) + 1)
  }

  return userRows.map((u) => {
    const list = reportsByUser.get(u.id) ?? []
    const has_report = list.length > 0
    let workHours = 0
    const projSet = new Set<string>()
    for (const rep of list) {
      workHours += hoursByReport.get(rep.id) ?? 0
      projSet.add(rep.projectId)
    }

    return {
      user_id: u.id,
      user_name: u.name?.trim() || '—',
      has_dept_project: userHasDeptProject.has(u.id),
      has_report,
      work_days: hoursToWorkDays(workHours),
      project_count: projSet.size,
      file_upload_count: fileCountByUser.get(u.id) ?? 0,
    }
  })
}

export async function getWeeklyDeptByProject(
  params: WeeklyDeptStatsParams
): Promise<WeeklyDeptByProjectRow[]> {
  const db = getDb()
  const weekCode = params.weekCode.trim()
  const deptIds = await getDepartmentIdsForListFilter(params.departmentId)

  const projectConditions = [
    inArray(projects.departmentId, deptIds),
    inArray(projects.projectStatus, ['active', 'suspended']),
    isNull(projects.deletedAt),
  ]
  const pk = params.projectKeyword?.trim()
  if (pk) {
    const k = `%${escapeForILike(pk)}%`
    const projectFilter = or(ilike(projects.projectName, k), ilike(projects.projectNo, k))
    if (projectFilter) projectConditions.push(projectFilter)
  }

  const plist = await db
    .select({
      id: projects.id,
      projectNo: projects.projectNo,
      projectName: projects.projectName,
      projectStatus: projects.projectStatus,
    })
    .from(projects)
    .where(and(...projectConditions))
    .orderBy(asc(projects.projectNo))

  if (!plist.length) return []

  const projectIds = plist.map((p) => p.id)

  const exRows = await db
    .select({
      projectId: projectWeekExemptions.projectId,
      startWeekCode: projectWeekExemptions.startWeekCode,
      endWeekCode: projectWeekExemptions.endWeekCode,
    })
    .from(projectWeekExemptions)
    .where(inArray(projectWeekExemptions.projectId, projectIds))

  const exByProject = new Map<
    string,
    { startWeekCode: string; endWeekCode: string | null }[]
  >()
  for (const row of exRows) {
    const pid = row.projectId
    const list = exByProject.get(pid) ?? []
    list.push({
      startWeekCode: row.startWeekCode,
      endWeekCode: row.endWeekCode,
    })
    exByProject.set(pid, list)
  }

  const reportRows = await db
    .select({
      id: weeklyReports.id,
      projectId: weeklyReports.projectId,
      status: weeklyReports.status,
    })
    .from(weeklyReports)
    .where(
      and(
        eq(weeklyReports.weekCode, weekCode),
        inArray(weeklyReports.projectId, projectIds),
        ne(weeklyReports.status, 'draft')
      )
    )

  const reportIds = reportRows.map((r) => r.id)
  const hoursByReport = new Map<string, number>()
  if (reportIds.length) {
    const items = await db
      .select({
        reportId: weeklyReportItems.reportId,
        workDays: weeklyReportItems.workDays,
        itemType: weeklyReportItems.itemType,
      })
      .from(weeklyReportItems)
      .where(inArray(weeklyReportItems.reportId, reportIds))

    for (const it of items) {
      if (it.itemType !== 'work') continue
      const rid = it.reportId
      const d = it.workDays != null ? Number(it.workDays) : 0
      hoursByReport.set(rid, (hoursByReport.get(rid) ?? 0) + d * 8)
    }
  }

  const byProject = new Map<string, typeof reportRows>()
  for (const r of reportRows) {
    const list = byProject.get(r.projectId) ?? []
    list.push(r)
    byProject.set(r.projectId, list)
  }

  return plist.map((p) => {
    const list = byProject.get(p.id) ?? []
    let totalH = 0
    let pending = 0
    for (const r of list) {
      totalH += hoursByReport.get(r.id) ?? 0
      if (r.status === 'pending') pending += 1
    }
    return {
      project_id: p.id,
      project_no: p.projectNo,
      project_name: p.projectName,
      project_status: p.projectStatus,
      no_work_exemption: weekCoveredByExemptions(weekCode, exByProject.get(p.id) ?? []),
      report_count: list.length,
      pending_count: pending,
      total_work_days: hoursToWorkDays(totalH),
    }
  })
}

export async function getWeeklyDeptDetails(
  params: WeeklyDeptStatsParams
): Promise<WeeklyDeptDetailRow[]> {
  const db = getDb()
  const weekCode = params.weekCode.trim()
  let projectIds = await getProjectIdsInDepartmentScope(params.departmentId)
  if (!projectIds.length) return []

  const pk = params.projectKeyword?.trim()
  if (pk) {
    const k = `%${escapeForILike(pk)}%`
    const matchRows = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          inArray(projects.id, projectIds),
          or(ilike(projects.projectName, k), ilike(projects.projectNo, k))
        )
      )
    projectIds = matchRows.map((r) => r.id)
    if (!projectIds.length) return []
  }

  const reportConditions = [
    eq(weeklyReports.weekCode, weekCode),
    inArray(weeklyReports.projectId, projectIds),
    ne(weeklyReports.status, 'draft'),
  ]

  const pn = params.personNameKeyword?.trim()
  if (pn) {
    const matchUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(ilike(users.name, `%${escapeForILike(pn)}%`))
    const uids = matchUsers.map((r) => r.id)
    if (!uids.length) return []
    reportConditions.push(inArray(weeklyReports.userId, uids))
  }

  const reportRows = await db
    .select({
      id: weeklyReports.id,
      userId: weeklyReports.userId,
      projectId: weeklyReports.projectId,
      weekCode: weeklyReports.weekCode,
      status: weeklyReports.status,
      createdAt: weeklyReports.createdAt,
    })
    .from(weeklyReports)
    .where(and(...reportConditions))
    .orderBy(desc(weeklyReports.createdAt))

  if (!reportRows.length) return []

  const reportIds = reportRows.map((r) => r.id)
  const hoursByReport = new Map<string, number>()
  const countByReport = new Map<string, number>()
  const items = await db
    .select({
      reportId: weeklyReportItems.reportId,
      workDays: weeklyReportItems.workDays,
      itemType: weeklyReportItems.itemType,
    })
    .from(weeklyReportItems)
    .where(inArray(weeklyReportItems.reportId, reportIds))

  for (const it of items) {
    const rid = it.reportId
    countByReport.set(rid, (countByReport.get(rid) ?? 0) + 1)
    if (it.itemType !== 'work') continue
    const d = it.workDays != null ? Number(it.workDays) : 0
    hoursByReport.set(rid, (hoursByReport.get(rid) ?? 0) + d * 8)
  }

  const userIds = [...new Set(reportRows.map((r) => r.userId))]
  const projIds = [...new Set(reportRows.map((r) => r.projectId))]

  const userRows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(inArray(users.id, userIds))
  const userName = new Map(userRows.map((u) => [u.id, u.name?.trim() || '—']))

  const projRows = await db
    .select({
      id: projects.id,
      projectNo: projects.projectNo,
      projectName: projects.projectName,
    })
    .from(projects)
    .where(inArray(projects.id, projIds))
  const projNo = new Map(projRows.map((p) => [p.id, p.projectNo]))
  const projName = new Map(projRows.map((p) => [p.id, p.projectName]))

  const apprRows = await db
    .select({
      reportId: weeklyReportApprovals.reportId,
      createdAt: weeklyReportApprovals.createdAt,
    })
    .from(weeklyReportApprovals)
    .where(inArray(weeklyReportApprovals.reportId, reportIds))

  const approvedAtByReport = new Map<string, string>()
  for (const a of apprRows) {
    const rid = a.reportId
    const ca = a.createdAt != null ? String(a.createdAt) : ''
    const prev = approvedAtByReport.get(rid)
    if (!prev || ca > prev) {
      approvedAtByReport.set(rid, ca)
    }
  }

  return reportRows.map((r) => {
    const st = r.status as WeeklyReportStatus
    const label =
      WEEKLY_REPORT_STATUS_LABEL[st as keyof typeof WEEKLY_REPORT_STATUS_LABEL] ?? st
    const th = hoursByReport.get(r.id) ?? 0
    const submitted =
      st !== 'draft' && r.createdAt
        ? String(r.createdAt).slice(0, 19).replace('T', ' ')
        : null
    const appr = approvedAtByReport.get(r.id)
    const approved_at = appr ? appr.slice(0, 19).replace('T', ' ') : null

    return {
      report_id: r.id,
      user_id: r.userId,
      user_name: userName.get(r.userId) ?? '—',
      project_id: r.projectId,
      project_no: projNo.get(r.projectId) ?? null,
      project_name: projName.get(r.projectId) ?? null,
      week_code: r.weekCode,
      status: label,
      work_days: hoursToWorkDays(th),
      item_count: countByReport.get(r.id) ?? 0,
      submitted_at: submitted,
      approved_at,
      submit_overdue: '—',
      submit_overdue_reason: '—',
      approval_overdue: '—',
      approval_overdue_reason: '—',
    }
  })
}
