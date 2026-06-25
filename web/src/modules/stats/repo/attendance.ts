import { and, asc, eq, gte, inArray, isNull, lte, ne } from 'drizzle-orm'
import { getDb } from '@/core/db/client'
import {
  projects,
  users,
  weeklyReportItems,
  weeklyReports,
  weeks,
} from '@/core/db/schema'
import { compareWeekCode } from '@/modules/weekly/lib/iso-week'
import {
  formatWeekRangeLine,
  formatWeekTitleZh,
} from '@/modules/weekly/lib/week-display'
import {
  formatWorkSlotsBriefZh,
  parseWorkDatesJson,
} from '@/modules/weekly/lib/weekly-report-work-slots'
import { getDepartmentIdsForListFilter } from '@/modules/org/departments/repo'
import type { Json } from '@/types/json'
import type {
  AttendanceDetailRow,
  AttendanceProjectSummaryRow,
  AttendanceSummaryRowPerson,
} from '../types'

function maxIso(a: string, b: string): string {
  return a >= b ? a : b
}

function minIso(a: string, b: string): string {
  return a <= b ? a : b
}

function countInclusiveDays(startIso: string, endIso: string): number {
  const s = new Date(`${startIso}T12:00:00`)
  const e = new Date(`${endIso}T12:00:00`)
  const diff = (e.getTime() - s.getTime()) / 86400000
  return Math.floor(diff) + 1
}

function overlapDaysWithMonth(
  weekStart: string | null,
  weekEnd: string | null,
  monthStart: string,
  monthEnd: string
): number {
  if (!weekStart?.trim() || !weekEnd?.trim()) return 0
  const ws = weekStart.trim().slice(0, 10)
  const we = weekEnd.trim().slice(0, 10)
  const segStart = maxIso(ws, monthStart)
  const segEnd = minIso(we, monthEnd)
  if (segStart > segEnd) return 0
  return countInclusiveDays(segStart, segEnd)
}

function weekSpanDays(weekStart: string | null, weekEnd: string | null): number {
  if (!weekStart?.trim() || !weekEnd?.trim()) return 7
  const ws = weekStart.trim().slice(0, 10)
  const we = weekEnd.trim().slice(0, 10)
  return Math.max(1, countInclusiveDays(ws, we))
}

function attributedWorkDaysInMonth(
  item: {
    itemType: string
    workDays: string | null
    workDates: Json | null
  },
  weekStart: string | null,
  weekEnd: string | null,
  monthStart: string,
  monthEnd: string
): { attributed: number; original: number } {
  const original =
    item.itemType === 'work' && item.workDays != null
      ? Number(item.workDays)
      : 0
  if (item.itemType !== 'work' || !Number.isFinite(original) || original <= 0) {
    return { attributed: 0, original }
  }

  const slots = parseWorkDatesJson(item.workDates)
  if (slots.length > 0) {
    let halves = 0
    for (const s of slots) {
      const d = s.isoDate.slice(0, 10)
      if (d >= monthStart && d <= monthEnd) halves += 1
    }
    return { attributed: halves * 0.5, original }
  }

  const wd = weekSpanDays(weekStart, weekEnd)
  const od = overlapDaysWithMonth(weekStart, weekEnd, monthStart, monthEnd)
  if (od <= 0) return { attributed: 0, original }
  const r = (original * od) / wd
  return { attributed: Math.round(r * 10) / 10, original }
}

function parseYearMonth(yearMonth: string): { monthStart: string; monthEnd: string } {
  const parts = yearMonth.trim().split('-')
  const y = Number(parts[0])
  const m = Number(parts[1])
  if (!y || !m || m < 1 || m > 12) {
    throw new Error('invalid month')
  }
  const monthStart = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const monthEnd = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { monthStart, monthEnd }
}

async function getWeekCodesOverlappingMonth(
  monthStart: string,
  monthEnd: string
): Promise<
  { weekCode: string; startDate: string | null; endDate: string | null }[]
> {
  const db = getDb()
  const rows = await db
    .select({
      weekCode: weeks.weekCode,
      startDate: weeks.startDate,
      endDate: weeks.endDate,
    })
    .from(weeks)
    .where(and(lte(weeks.startDate, monthEnd), gte(weeks.endDate, monthStart)))

  return rows.map((r) => ({
    weekCode: r.weekCode,
    startDate: r.startDate,
    endDate: r.endDate,
  }))
}

async function projectIdsInDepartmentScope(departmentId: string): Promise<string[]> {
  const db = getDb()
  const deptIds = await getDepartmentIdsForListFilter(departmentId)
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(inArray(projects.departmentId, deptIds), isNull(projects.deletedAt)))

  return rows.map((r) => r.id)
}

export async function getAttendanceSummary(
  departmentId: string,
  yearMonth: string
): Promise<AttendanceSummaryRowPerson[]> {
  const { monthStart, monthEnd } = parseYearMonth(yearMonth)
  const deptIds = await getDepartmentIdsForListFilter(departmentId)
  const projectIds = await projectIdsInDepartmentScope(departmentId)
  if (!projectIds.length) return []

  const weekRows = await getWeekCodesOverlappingMonth(monthStart, monthEnd)
  const weekCodes = weekRows.map((w) => w.weekCode)
  const weekMeta = new Map(
    weekRows.map((w) => [w.weekCode, { start: w.startDate, end: w.endDate }])
  )

  const db = getDb()
  const userList = await db
    .select({
      id: users.id,
      name: users.name,
      employeeNo: users.employeeNo,
    })
    .from(users)
    .where(and(inArray(users.departmentId, deptIds), isNull(users.deletedAt)))
    .orderBy(asc(users.name))

  if (!weekCodes.length) {
    return userList.map((u) => ({
      user_id: u.id,
      user_name: u.name?.trim() || '—',
      employee_no: u.employeeNo?.trim() ?? null,
      work_days: 0,
    }))
  }

  const itemRows = await db
    .select({
      workDays: weeklyReportItems.workDays,
      workDates: weeklyReportItems.workDates,
      itemType: weeklyReportItems.itemType,
      userId: weeklyReports.userId,
      weekCode: weeklyReports.weekCode,
    })
    .from(weeklyReportItems)
    .innerJoin(weeklyReports, eq(weeklyReportItems.reportId, weeklyReports.id))
    .where(
      and(
        inArray(weeklyReports.weekCode, weekCodes),
        inArray(weeklyReports.projectId, projectIds),
        ne(weeklyReports.status, 'draft'),
        eq(weeklyReportItems.itemType, 'work')
      )
    )

  const daysByUser = new Map<string, number>()
  for (const it of itemRows) {
    const wm = weekMeta.get(it.weekCode)
    const { attributed } = attributedWorkDaysInMonth(
      { ...it, workDates: it.workDates as Json | null },
      wm?.start ?? null,
      wm?.end ?? null,
      monthStart,
      monthEnd
    )
    if (attributed <= 0) continue
    daysByUser.set(it.userId, (daysByUser.get(it.userId) ?? 0) + attributed)
  }

  return userList.map((u) => ({
    user_id: u.id,
    user_name: u.name?.trim() || '—',
    employee_no: u.employeeNo?.trim() ?? null,
    work_days: Math.round((daysByUser.get(u.id) ?? 0) * 10) / 10,
  }))
}

export async function getAttendanceProjectSummary(
  departmentId: string,
  yearMonth: string
): Promise<AttendanceProjectSummaryRow[]> {
  const { monthStart, monthEnd } = parseYearMonth(yearMonth)
  const projectIds = await projectIdsInDepartmentScope(departmentId)
  if (!projectIds.length) return []

  const weekRows = await getWeekCodesOverlappingMonth(monthStart, monthEnd)
  const weekCodes = weekRows.map((w) => w.weekCode)
  const weekMeta = new Map(
    weekRows.map((w) => [w.weekCode, { start: w.startDate, end: w.endDate }])
  )
  if (!weekCodes.length) return []

  const db = getDb()
  const itemRows = await db
    .select({
      workDays: weeklyReportItems.workDays,
      workDates: weeklyReportItems.workDates,
      itemType: weeklyReportItems.itemType,
      userId: weeklyReports.userId,
      projectId: weeklyReports.projectId,
      weekCode: weeklyReports.weekCode,
    })
    .from(weeklyReportItems)
    .innerJoin(weeklyReports, eq(weeklyReportItems.reportId, weeklyReports.id))
    .where(
      and(
        inArray(weeklyReports.weekCode, weekCodes),
        inArray(weeklyReports.projectId, projectIds),
        ne(weeklyReports.status, 'draft'),
        eq(weeklyReportItems.itemType, 'work')
      )
    )

  const sumKey = new Map<string, number>()
  const seenUserIds = new Set<string>()
  const seenProjIds = new Set<string>()

  for (const it of itemRows) {
    const wm = weekMeta.get(it.weekCode)
    const { attributed } = attributedWorkDaysInMonth(
      { ...it, workDates: it.workDates as Json | null },
      wm?.start ?? null,
      wm?.end ?? null,
      monthStart,
      monthEnd
    )
    if (attributed <= 0) continue
    const k = `${it.userId}\t${it.projectId}`
    sumKey.set(k, (sumKey.get(k) ?? 0) + attributed)
    seenUserIds.add(it.userId)
    seenProjIds.add(it.projectId)
  }

  if (!sumKey.size) return []

  const userRows = await db
    .select({ id: users.id, name: users.name, employeeNo: users.employeeNo })
    .from(users)
    .where(inArray(users.id, [...seenUserIds]))
  const userName = new Map(
    userRows.map((u) => [
      u.id,
      { name: u.name?.trim() || '—', no: u.employeeNo?.trim() ?? null },
    ])
  )

  const projRows = await db
    .select({ id: projects.id, projectName: projects.projectName })
    .from(projects)
    .where(inArray(projects.id, [...seenProjIds]))
  const projName = new Map(projRows.map((p) => [p.id, p.projectName]))

  const rows: AttendanceProjectSummaryRow[] = []
  for (const [key, sum] of sumKey) {
    const [uid, pid] = key.split('\t')
    const u = userName.get(uid)
    rows.push({
      user_id: uid,
      user_name: u?.name ?? '—',
      employee_no: u?.no ?? null,
      project_id: pid,
      project_name: projName.get(pid) ?? null,
      work_days: Math.round(sum * 10) / 10,
    })
  }

  rows.sort((a, b) => {
    const cn = a.user_name.localeCompare(b.user_name, 'zh-CN', { sensitivity: 'base' })
    if (cn !== 0) return cn
    return (a.project_name ?? '').localeCompare(b.project_name ?? '', 'zh-CN', {
      sensitivity: 'base',
    })
  })

  return rows
}

export async function getAttendanceDetails(
  departmentId: string,
  yearMonth: string
): Promise<AttendanceDetailRow[]> {
  const { monthStart, monthEnd } = parseYearMonth(yearMonth)
  const projectIds = await projectIdsInDepartmentScope(departmentId)
  if (!projectIds.length) return []

  const weekRows = await getWeekCodesOverlappingMonth(monthStart, monthEnd)
  const weekCodes = weekRows.map((w) => w.weekCode)
  const weekMeta = new Map(
    weekRows.map((w) => [w.weekCode, { start: w.startDate, end: w.endDate }])
  )
  if (!weekCodes.length) return []

  const db = getDb()
  const itemRows = await db
    .select({
      id: weeklyReportItems.id,
      itemDesc: weeklyReportItems.itemDesc,
      workDays: weeklyReportItems.workDays,
      workDates: weeklyReportItems.workDates,
      itemType: weeklyReportItems.itemType,
      sortOrder: weeklyReportItems.sortOrder,
      userId: weeklyReports.userId,
      projectId: weeklyReports.projectId,
      weekCode: weeklyReports.weekCode,
    })
    .from(weeklyReportItems)
    .innerJoin(weeklyReports, eq(weeklyReportItems.reportId, weeklyReports.id))
    .where(
      and(
        inArray(weeklyReports.weekCode, weekCodes),
        inArray(weeklyReports.projectId, projectIds),
        ne(weeklyReports.status, 'draft'),
        eq(weeklyReportItems.itemType, 'work')
      )
    )
    .orderBy(asc(weeklyReportItems.sortOrder))

  const seenUserIds = new Set<string>()
  const seenProjIds = new Set<string>()
  for (const it of itemRows) {
    seenUserIds.add(it.userId)
    seenProjIds.add(it.projectId)
  }
  if (!seenUserIds.size) return []

  const userRows = await db
    .select({ id: users.id, name: users.name, employeeNo: users.employeeNo })
    .from(users)
    .where(inArray(users.id, [...seenUserIds]))
  const userName = new Map(
    userRows.map((u) => [
      u.id,
      { name: u.name?.trim() || '—', no: u.employeeNo?.trim() ?? null },
    ])
  )

  const projRows = await db
    .select({ id: projects.id, projectName: projects.projectName })
    .from(projects)
    .where(inArray(projects.id, [...seenProjIds]))
  const projName = new Map(projRows.map((p) => [p.id, p.projectName]))

  type Sortable = {
    row: AttendanceDetailRow
    week_code: string
    sort_order: number
    user_name: string
  }

  const sortable: Sortable[] = itemRows.map((it) => {
    const u = userName.get(it.userId)
    const wm = weekMeta.get(it.weekCode)
    const desc = it.itemDesc?.trim()
    const content = desc ? desc : '—'
    const workDates = it.workDates as Json | null
    const slots = parseWorkDatesJson(workDates)
    const dr = formatWorkSlotsBriefZh(slots)
    const { attributed, original } = attributedWorkDaysInMonth(
      { ...it, workDates },
      wm?.start ?? null,
      wm?.end ?? null,
      monthStart,
      monthEnd
    )
    const un = u?.name ?? '—'

    return {
      row: {
        id: String(it.id),
        user_name: un,
        employee_no: u?.no ?? null,
        project_name: projName.get(it.projectId) ?? null,
        week_label: formatWeekTitleZh(it.weekCode),
        work_content: content,
        date_range:
          dr !== '—'
            ? dr
            : wm?.start?.trim() && wm?.end?.trim()
              ? formatWeekRangeLine(wm.start.trim(), wm.end.trim()) || '—'
              : '—',
        work_days: attributed,
        original_work_days: original,
      },
      week_code: it.weekCode,
      sort_order: Number(it.sortOrder) || 0,
      user_name: un,
    }
  })

  sortable.sort((a, b) => {
    const cw = compareWeekCode(b.week_code, a.week_code)
    if (cw !== 0) return cw
    const cn = a.user_name.localeCompare(b.user_name, 'zh-CN', { sensitivity: 'base' })
    if (cn !== 0) return cn
    return a.sort_order - b.sort_order
  })

  return sortable.map((s) => s.row).filter((row) => row.work_days > 0)
}

/** 个人考勤明细：当前用户全部项目，周次列带「（MM/DD~MM/DD）」 */
export async function getMyAttendanceDetails(
  userId: string,
  yearMonth: string
): Promise<AttendanceDetailRow[]> {
  const { monthStart, monthEnd } = parseYearMonth(yearMonth)
  const weekRows = await getWeekCodesOverlappingMonth(monthStart, monthEnd)
  const weekCodes = weekRows.map((w) => w.weekCode)
  const weekMeta = new Map(
    weekRows.map((w) => [w.weekCode, { start: w.startDate, end: w.endDate }])
  )
  if (!weekCodes.length) return []

  const db = getDb()
  const itemRows = await db
    .select({
      id: weeklyReportItems.id,
      itemDesc: weeklyReportItems.itemDesc,
      workDays: weeklyReportItems.workDays,
      workDates: weeklyReportItems.workDates,
      itemType: weeklyReportItems.itemType,
      sortOrder: weeklyReportItems.sortOrder,
      userId: weeklyReports.userId,
      projectId: weeklyReports.projectId,
      weekCode: weeklyReports.weekCode,
    })
    .from(weeklyReportItems)
    .innerJoin(weeklyReports, eq(weeklyReportItems.reportId, weeklyReports.id))
    .where(
      and(
        eq(weeklyReports.userId, userId),
        inArray(weeklyReports.weekCode, weekCodes),
        ne(weeklyReports.status, 'draft'),
        eq(weeklyReportItems.itemType, 'work')
      )
    )
    .orderBy(asc(weeklyReportItems.sortOrder))

  const userRows = await db
    .select({
      id: users.id,
      name: users.name,
      employeeNo: users.employeeNo,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const userRow = userRows[0]
  const un = userRow?.name?.trim() || '—'
  const eno = userRow?.employeeNo?.trim() ?? null

  const seenProjIds = new Set<string>()
  for (const it of itemRows) {
    if (it.projectId) seenProjIds.add(it.projectId)
  }

  const projName = new Map<string, string | null>()
  if (seenProjIds.size) {
    const projRows = await db
      .select({ id: projects.id, projectName: projects.projectName })
      .from(projects)
      .where(inArray(projects.id, [...seenProjIds]))
    for (const p of projRows) projName.set(p.id, p.projectName)
  }

  type Sortable = {
    row: AttendanceDetailRow
    week_code: string
    sort_order: number
    project_name: string | null
  }

  const sortable: Sortable[] = itemRows.map((it) => {
    const wm = weekMeta.get(it.weekCode)
    const desc = it.itemDesc?.trim()
    const content = desc ? desc : '—'
    const workDates = it.workDates as Json | null
    const slots = parseWorkDatesJson(workDates)
    const dr = formatWorkSlotsBriefZh(slots)
    const { attributed, original } = attributedWorkDaysInMonth(
      { ...it, workDates },
      wm?.start ?? null,
      wm?.end ?? null,
      monthStart,
      monthEnd
    )

    const weekTitle = formatWeekTitleZh(it.weekCode)
    const rangeLine =
      wm?.start?.trim() && wm?.end?.trim()
        ? formatWeekRangeLine(wm.start.trim(), wm.end.trim())
        : ''
    const week_label = rangeLine !== '' ? `${weekTitle}（${rangeLine}）` : weekTitle
    const pn = projName.get(it.projectId) ?? null

    return {
      row: {
        id: String(it.id),
        user_name: un,
        employee_no: eno,
        project_name: pn,
        week_label,
        work_content: content,
        date_range:
          dr !== '—'
            ? dr
            : wm?.start?.trim() && wm?.end?.trim()
              ? formatWeekRangeLine(wm.start.trim(), wm.end.trim()) || '—'
              : '—',
        work_days: attributed,
        original_work_days: original,
      },
      week_code: it.weekCode,
      sort_order: Number(it.sortOrder) || 0,
      project_name: pn,
    }
  })

  sortable.sort((a, b) => {
    const cw = compareWeekCode(b.week_code, a.week_code)
    if (cw !== 0) return cw
    const cp = (a.project_name ?? '').localeCompare(b.project_name ?? '', 'zh-CN', {
      sensitivity: 'base',
    })
    if (cp !== 0) return cp
    return a.sort_order - b.sort_order
  })

  return sortable.map((s) => s.row).filter((row) => row.work_days > 0)
}

/** 所选月份个人考勤天数合计（与明细一致） */
export async function getMyMonthWorkDaysTotal(
  userId: string,
  yearMonth: string
): Promise<number> {
  const rows = await getMyAttendanceDetails(userId, yearMonth)
  const sum = rows.reduce((acc, r) => acc + r.work_days, 0)
  return Math.round(sum * 10) / 10
}
