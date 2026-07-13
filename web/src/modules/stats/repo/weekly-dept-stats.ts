import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, ne, or } from 'drizzle-orm'
import { getDb } from '@/core/db/client'
import {
  departments,
  files,
  projectMembers,
  projects,
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
  WeeklyProjectPersonRangeRow,
} from '../types'

const EFFECTIVE_REPORT_STATUS = 'approved'

function escapeForILike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
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
  projectStage?: string | null
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
  const stage = params.projectStage?.trim() || null

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
    .where(
      and(
        inArray(projectMembers.projectId, projectIds),
        eq(projectMembers.isActive, true),
        isNull(projectMembers.deletedAt),
        ...(stage ? [eq(projectMembers.projectStage, stage as '实施阶段' | '销售阶段')] : [])
      )
    )

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
        eq(weeklyReports.status, EFFECTIVE_REPORT_STATUS),
        ...(stage ? [eq(weeklyReports.projectStage, stage as '实施阶段' | '销售阶段')] : [])
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
    eq(projects.isActive, true),
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
      projectStage: projects.projectStage,
    })
    .from(projects)
    .where(and(...projectConditions))
    .orderBy(asc(projects.projectNo))

  if (!plist.length) return []

  const projectIds = plist.map((p) => p.id)
  const stage = params.projectStage?.trim() || null

  const reportRows = await db
    .select({
      id: weeklyReports.id,
      projectId: weeklyReports.projectId,
      projectStage: weeklyReports.projectStage,
      status: weeklyReports.status,
    })
    .from(weeklyReports)
    .where(
      and(
        eq(weeklyReports.weekCode, weekCode),
        inArray(weeklyReports.projectId, projectIds),
        eq(weeklyReports.status, EFFECTIVE_REPORT_STATUS),
        ...(stage ? [eq(weeklyReports.projectStage, stage as '实施阶段' | '销售阶段')] : [])
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

  const byProjectStage = new Map<string, typeof reportRows>()
  for (const r of reportRows) {
    const key = `${r.projectId}:${r.projectStage}`
    const list = byProjectStage.get(key) ?? []
    list.push(r)
    byProjectStage.set(key, list)
  }

  const rows: WeeklyDeptByProjectRow[] = []
  for (const p of plist) {
    const stages =
      stage != null
        ? [stage]
        : p.projectStage === '销售阶段'
          ? ['销售阶段']
          : ['实施阶段', '销售阶段']
    for (const projectStage of stages) {
      const list = byProjectStage.get(`${p.id}:${projectStage}`) ?? []
    let totalH = 0
    for (const r of list) {
      totalH += hoursByReport.get(r.id) ?? 0
    }
      rows.push({
      project_id: p.id,
      project_no: p.projectNo,
      project_name: p.projectName,
        project_stage: projectStage,
      project_status: p.projectStatus,
      report_count: list.length,
      total_work_days: hoursToWorkDays(totalH),
      })
    }
  }
  return rows
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
    eq(weeklyReports.status, EFFECTIVE_REPORT_STATUS),
  ]
  const stage = params.projectStage?.trim()
  if (stage) {
    reportConditions.push(
      eq(weeklyReports.projectStage, stage as '实施阶段' | '销售阶段')
    )
  }

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
      projectStage: weeklyReports.projectStage,
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
    const label =
      WEEKLY_REPORT_STATUS_LABEL[
        r.status as keyof typeof WEEKLY_REPORT_STATUS_LABEL
      ] ?? r.status
    const th = hoursByReport.get(r.id) ?? 0
    const submitted = r.createdAt
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
      project_stage: r.projectStage,
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

export interface WeeklyProjectPersonRangeParams {
  departmentId: string
  projectKeyword: string
  projectStage?: string | null
  weekCodeFrom: string
  weekCodeTo: string
  personNameKeyword?: string | null
}

async function getWeekCodesInRange(from: string, to: string): Promise<string[]> {
  const db = getDb()
  const start = from.trim()
  const end = to.trim()
  if (!start || !end) return []
  const rows = await db
    .select({ weekCode: weeks.weekCode })
    .from(weeks)
    .where(and(gte(weeks.weekCode, start), lte(weeks.weekCode, end)))
    .orderBy(asc(weeks.weekCode))
  return rows
    .map((row) => row.weekCode)
    .filter((week) => compareWeekCode(week, start) >= 0 && compareWeekCode(week, end) <= 0)
}

export async function getWeeklyProjectPersonRange(
  params: WeeklyProjectPersonRangeParams
): Promise<WeeklyProjectPersonRangeRow[]> {
  const db = getDb()
  const deptIds = await getDepartmentIdsForListFilter(params.departmentId)
  const keyword = params.projectKeyword.trim()
  if (!keyword) return []
  const k = `%${escapeForILike(keyword)}%`
  const projectRows = await db
    .select({
      id: projects.id,
      projectStage: projects.projectStage,
    })
    .from(projects)
    .where(
      and(
        inArray(projects.departmentId, deptIds),
        isNull(projects.deletedAt),
        or(ilike(projects.projectName, k), ilike(projects.projectNo, k))
      )
    )
    .orderBy(asc(projects.projectNo))
    .limit(20)

  const projectIds = projectRows.map((p) => p.id)
  if (!projectIds.length) return []

  const weekCodes = await getWeekCodesInRange(
    params.weekCodeFrom,
    params.weekCodeTo
  )
  if (!weekCodes.length) return []

  const stage = params.projectStage?.trim() || null
  const reportConditions = [
    inArray(weeklyReports.projectId, projectIds),
    inArray(weeklyReports.weekCode, weekCodes),
    eq(weeklyReports.status, EFFECTIVE_REPORT_STATUS),
  ]
  if (stage) {
    reportConditions.push(
      eq(weeklyReports.projectStage, stage as '实施阶段' | '销售阶段')
    )
  }

  const personKeyword = params.personNameKeyword?.trim()
  let allowedUserIds: string[] | null = null
  if (personKeyword) {
    const matchedUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(ilike(users.name, `%${escapeForILike(personKeyword)}%`))
    allowedUserIds = matchedUsers.map((u) => u.id)
    if (!allowedUserIds.length) return []
    reportConditions.push(inArray(weeklyReports.userId, allowedUserIds))
  }

  const reportRows = await db
    .select({
      id: weeklyReports.id,
      userId: weeklyReports.userId,
      projectId: weeklyReports.projectId,
      projectStage: weeklyReports.projectStage,
      weekCode: weeklyReports.weekCode,
      submitTime: weeklyReports.submitTime,
      createdAt: weeklyReports.createdAt,
    })
    .from(weeklyReports)
    .where(and(...reportConditions))

  if (!reportRows.length) return []

  const reportIds = reportRows.map((r) => r.id)
  const items = await db
    .select({
      reportId: weeklyReportItems.reportId,
      workDays: weeklyReportItems.workDays,
      itemType: weeklyReportItems.itemType,
    })
    .from(weeklyReportItems)
    .where(inArray(weeklyReportItems.reportId, reportIds))

  const daysByReport = new Map<string, number>()
  for (const item of items) {
    if (item.itemType !== 'work') continue
    daysByReport.set(
      item.reportId,
      (daysByReport.get(item.reportId) ?? 0) + Number(item.workDays ?? 0)
    )
  }

  const userIds = [...new Set(reportRows.map((r) => r.userId))]
  const [userRows, memberRows] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        employeeNo: users.employeeNo,
        departmentName: departments.name,
      })
      .from(users)
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(inArray(users.id, userIds)),
    db
      .select({
        userId: projectMembers.userId,
        projectRole: projectMembers.projectRole,
        projectStage: projectMembers.projectStage,
      })
      .from(projectMembers)
      .where(
        and(
          inArray(projectMembers.projectId, projectIds),
          inArray(projectMembers.userId, userIds),
          eq(projectMembers.isActive, true),
          isNull(projectMembers.deletedAt)
        )
      ),
  ])

  const userInfo = new Map(
    userRows.map((u) => [
      u.id,
      {
        name: u.name?.trim() || '—',
        employeeNo: u.employeeNo ?? null,
        departmentName: u.departmentName ?? null,
      },
    ])
  )
  const rolesByUserStage = new Map<string, Set<string>>()
  for (const member of memberRows) {
    if (!member.userId || !member.projectStage) continue
    const key = `${member.userId}:${member.projectStage}`
    const set = rolesByUserStage.get(key) ?? new Set<string>()
    if (member.projectRole?.trim()) set.add(member.projectRole.trim())
    rolesByUserStage.set(key, set)
  }

  const byUserStage = new Map<string, WeeklyProjectPersonRangeRow>()
  for (const report of reportRows) {
    const key = `${report.userId}:${report.projectStage}`
    const info = userInfo.get(report.userId)
    const row =
      byUserStage.get(key) ??
      ({
        user_id: report.userId,
        user_name: info?.name ?? '—',
        employee_no: info?.employeeNo ?? null,
        department_name: info?.departmentName ?? null,
        project_roles: [
          ...(rolesByUserStage.get(`${report.userId}:${report.projectStage}`) ??
            new Set<string>()),
        ].join('、'),
        project_stage: report.projectStage,
        week_days: Object.fromEntries(weekCodes.map((week) => [week, 0])),
        total_work_days: 0,
        submitted_week_count: 0,
        missing_week_count: weekCodes.length,
        latest_submitted_at: null,
      } satisfies WeeklyProjectPersonRangeRow)
    const days = daysByReport.get(report.id) ?? 0
    row.week_days[report.weekCode] = (row.week_days[report.weekCode] ?? 0) + days
    row.total_work_days = Math.round((row.total_work_days + days) * 10) / 10
    const submittedAt = report.submitTime ?? report.createdAt
    const submittedStr = submittedAt ? String(submittedAt).slice(0, 19).replace('T', ' ') : null
    if (submittedStr && (!row.latest_submitted_at || submittedStr > row.latest_submitted_at)) {
      row.latest_submitted_at = submittedStr
    }
    byUserStage.set(key, row)
  }

  for (const row of byUserStage.values()) {
    row.submitted_week_count = Object.values(row.week_days).filter((d) => d > 0).length
    row.missing_week_count = Math.max(0, weekCodes.length - row.submitted_week_count)
  }

  return [...byUserStage.values()].sort((a, b) =>
    a.user_name.localeCompare(b.user_name, 'zh-CN')
  )
}
