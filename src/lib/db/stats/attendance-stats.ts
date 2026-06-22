import { createAdminClient } from '@/lib/supabase/admin'
import { getDepartmentIdsForListFilter } from '@/lib/db/admin/departments'
import { handleDbError } from '@/lib/db/handle-db-error'
import { compareWeekCode } from '@/lib/utils/iso-week'
import {
  formatWeekRangeLine,
  formatWeekTitleZh,
} from '@/lib/utils/week-display'
import {
  formatWorkSlotsBriefZh,
  parseWorkDatesJson,
} from '@/lib/utils/weekly-report-work-slots'
import type { Json } from '@/types/database'
import type {
  AttendanceDetailRow,
  AttendanceProjectSummaryRow,
  AttendanceSummaryRowPerson,
} from '@/types/stats'

type ReportMeta = { user_id: string; project_id: string; week_code: string }

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

/**
 * 本月考勤天数：优先按 work_dates 半天落在本月计；无半天数据时按周与月重叠日历天比例分摊 work_days。
 */
function attributedWorkDaysInMonth(
  item: {
    item_type: string
    work_days: number | null
    work_dates: Json | null
  },
  weekStart: string | null,
  weekEnd: string | null,
  monthStart: string,
  monthEnd: string
): { attributed: number; original: number } {
  const original =
    item.item_type === 'work' && item.work_days != null
      ? Number(item.work_days)
      : 0
  if (item.item_type !== 'work' || !Number.isFinite(original) || original <= 0) {
    return { attributed: 0, original }
  }

  const slots = parseWorkDatesJson(item.work_dates)
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
  supabase: ReturnType<typeof createAdminClient>,
  monthStart: string,
  monthEnd: string
): Promise<{ week_code: string; start_date: string | null; end_date: string | null }[]> {
  const { data, error } = await supabase
    .from('weeks')
    .select('week_code, start_date, end_date')
    .lte('start_date', monthEnd)
    .gte('end_date', monthStart)

  if (error) handleDbError(error)
  return (data ?? []) as {
    week_code: string
    start_date: string | null
    end_date: string | null
  }[]
}

async function projectIdsInDepartmentScope(departmentId: string): Promise<string[]> {
  const supabase = createAdminClient()
  const deptIds = await getDepartmentIdsForListFilter(departmentId)
  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .in('department_id', deptIds)
    .is('deleted_at', null)

  if (error) handleDbError(error)
  return (data ?? []).map((r) => r.id as string)
}

export async function getAttendanceSummary(
  departmentId: string,
  yearMonth: string
): Promise<AttendanceSummaryRowPerson[]> {
  const supabase = createAdminClient()
  const { monthStart, monthEnd } = parseYearMonth(yearMonth)
  const deptIds = await getDepartmentIdsForListFilter(departmentId)
  const projectIds = await projectIdsInDepartmentScope(departmentId)
  if (!projectIds.length) return []

  const weekRows = await getWeekCodesOverlappingMonth(supabase, monthStart, monthEnd)
  const weekCodes = weekRows.map((w) => w.week_code)
  const weekMeta = new Map(
    weekRows.map((w) => [
      w.week_code,
      { start: w.start_date, end: w.end_date },
    ])
  )

  const { data: users, error: uErr } = await supabase
    .from('users')
    .select('id, name, employee_no')
    .in('department_id', deptIds)
    .is('deleted_at', null)
    .order('name', { ascending: true })
  if (uErr) handleDbError(uErr)
  const userList = users ?? []

  if (!weekCodes.length) {
    return userList.map((u) => ({
      user_id: u.id,
      user_name: u.name?.trim() || '—',
      employee_no: u.employee_no?.trim() ?? null,
      work_days: 0,
    }))
  }

  // 直接从 items 出发，用 !inner join 在数据库侧过滤，避免把大量 reportIds 拼入 URL
  const { data: items, error: iErr } = await supabase
    .from('weekly_report_items')
    .select('work_days, item_type, work_dates, weekly_reports!inner(user_id, project_id, week_code, status)')
    .in('weekly_reports.week_code', weekCodes)
    .in('weekly_reports.project_id', projectIds)
    .neq('weekly_reports.status', 'draft')
    .eq('item_type', 'work')

  if (iErr) handleDbError(iErr)

  const daysByUser = new Map<string, number>()
  for (const it of items ?? []) {
    const report = it.weekly_reports as unknown as ReportMeta | null
    if (!report) continue
    const wm = weekMeta.get(report.week_code)
    const { attributed } = attributedWorkDaysInMonth(
      it,
      wm?.start ?? null,
      wm?.end ?? null,
      monthStart,
      monthEnd
    )
    if (attributed <= 0) continue
    daysByUser.set(
      report.user_id,
      (daysByUser.get(report.user_id) ?? 0) + attributed
    )
  }

  return userList.map((u) => ({
    user_id: u.id,
    user_name: u.name?.trim() || '—',
    employee_no: u.employee_no?.trim() ?? null,
    work_days: Math.round((daysByUser.get(u.id) ?? 0) * 10) / 10,
  }))
}

export async function getAttendanceProjectSummary(
  departmentId: string,
  yearMonth: string
): Promise<AttendanceProjectSummaryRow[]> {
  const supabase = createAdminClient()
  const { monthStart, monthEnd } = parseYearMonth(yearMonth)
  const projectIds = await projectIdsInDepartmentScope(departmentId)
  if (!projectIds.length) return []

  const weekRows = await getWeekCodesOverlappingMonth(supabase, monthStart, monthEnd)
  const weekCodes = weekRows.map((w) => w.week_code)
  const weekMeta = new Map(
    weekRows.map((w) => [
      w.week_code,
      { start: w.start_date, end: w.end_date },
    ])
  )
  if (!weekCodes.length) return []

  // 直接从 items 出发，用 !inner join 在数据库侧过滤，避免把大量 reportIds 拼入 URL
  const { data: items, error: iErr } = await supabase
    .from('weekly_report_items')
    .select('work_days, item_type, work_dates, weekly_reports!inner(user_id, project_id, week_code, status)')
    .in('weekly_reports.week_code', weekCodes)
    .in('weekly_reports.project_id', projectIds)
    .neq('weekly_reports.status', 'draft')
    .eq('item_type', 'work')

  if (iErr) handleDbError(iErr)

  const sumKey = new Map<string, number>()
  const seenUserIds = new Set<string>()
  const seenProjIds = new Set<string>()

  for (const it of items ?? []) {
    const report = it.weekly_reports as unknown as ReportMeta | null
    if (!report) continue
    const wm = weekMeta.get(report.week_code)
    const { attributed } = attributedWorkDaysInMonth(
      it,
      wm?.start ?? null,
      wm?.end ?? null,
      monthStart,
      monthEnd
    )
    if (attributed <= 0) continue
    const k = `${report.user_id}\t${report.project_id}`
    sumKey.set(k, (sumKey.get(k) ?? 0) + attributed)
    seenUserIds.add(report.user_id)
    seenProjIds.add(report.project_id)
  }

  if (!sumKey.size) return []

  const userIds = [...seenUserIds]
  const projIds = [...seenProjIds]

  const { data: userRows, error: uErr } = await supabase
    .from('users')
    .select('id, name, employee_no')
    .in('id', userIds)
  if (uErr) handleDbError(uErr)
  const userName = new Map(
    (userRows ?? []).map((u) => [
      u.id,
      { name: u.name?.trim() || '—', no: u.employee_no?.trim() ?? null },
    ])
  )

  const { data: projRows, error: pErr } = await supabase
    .from('projects')
    .select('id, project_name')
    .in('id', projIds)
  if (pErr) handleDbError(pErr)
  const projName = new Map((projRows ?? []).map((p) => [p.id, p.project_name]))

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
    const cn = a.user_name.localeCompare(b.user_name, 'zh-CN', {
      sensitivity: 'base',
    })
    if (cn !== 0) return cn
    const pn = (a.project_name ?? '').localeCompare(b.project_name ?? '', 'zh-CN', {
      sensitivity: 'base',
    })
    return pn
  })

  return rows
}

export async function getAttendanceDetails(
  departmentId: string,
  yearMonth: string
): Promise<AttendanceDetailRow[]> {
  const supabase = createAdminClient()
  const { monthStart, monthEnd } = parseYearMonth(yearMonth)
  const projectIds = await projectIdsInDepartmentScope(departmentId)
  if (!projectIds.length) return []

  const weekRows = await getWeekCodesOverlappingMonth(supabase, monthStart, monthEnd)
  const weekCodes = weekRows.map((w) => w.week_code)
  const weekMeta = new Map(
    weekRows.map((w) => [
      w.week_code,
      { start: w.start_date, end: w.end_date },
    ])
  )
  if (!weekCodes.length) return []

  // 直接从 items 出发，用 !inner join 在数据库侧过滤，避免把大量 reportIds 拼入 URL
  const { data: items, error: iErr } = await supabase
    .from('weekly_report_items')
    .select('id, item_desc, work_days, work_dates, item_type, sort_order, weekly_reports!inner(user_id, project_id, week_code, status)')
    .in('weekly_reports.week_code', weekCodes)
    .in('weekly_reports.project_id', projectIds)
    .neq('weekly_reports.status', 'draft')
    .eq('item_type', 'work')
    .order('sort_order', { ascending: true })

  if (iErr) handleDbError(iErr)

  const seenUserIds = new Set<string>()
  const seenProjIds = new Set<string>()
  for (const it of items ?? []) {
    const report = it.weekly_reports as unknown as ReportMeta | null
    if (!report) continue
    seenUserIds.add(report.user_id)
    seenProjIds.add(report.project_id)
  }

  if (!seenUserIds.size) return []

  const { data: userRows, error: uErr } = await supabase
    .from('users')
    .select('id, name, employee_no')
    .in('id', [...seenUserIds])
  if (uErr) handleDbError(uErr)
  const userName = new Map(
    (userRows ?? []).map((u) => [
      u.id,
      { name: u.name?.trim() || '—', no: u.employee_no?.trim() ?? null },
    ])
  )

  const { data: projRows, error: pErr } = await supabase
    .from('projects')
    .select('id, project_name')
    .in('id', [...seenProjIds])
  if (pErr) handleDbError(pErr)
  const projName = new Map((projRows ?? []).map((p) => [p.id, p.project_name]))

  const itemList = items ?? []
  type Sortable = {
    row: AttendanceDetailRow
    week_code: string
    sort_order: number
    user_name: string
  }
  const sortable: Sortable[] = itemList.map((it) => {
    const report = it.weekly_reports as unknown as ReportMeta | null
    if (!report) {
      return {
        row: {
          id: String(it.id ?? ''),
          user_name: '—',
          employee_no: null,
          project_name: null,
          week_label: '—',
          work_content: '—',
          date_range: '—',
          work_days: 0,
          original_work_days: 0,
        },
        week_code: '',
        sort_order: 0,
        user_name: '',
      }
    }
    const u = userName.get(report.user_id)
    const wm = weekMeta.get(report.week_code)
    const desc = (it.item_desc as string | null)?.trim()
    const content = desc ? desc : '—'
    const slots = parseWorkDatesJson(it.work_dates)
    const dr = formatWorkSlotsBriefZh(slots)
    const { attributed, original } = attributedWorkDaysInMonth(
      it,
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
        project_name: projName.get(report.project_id) ?? null,
        week_label: formatWeekTitleZh(report.week_code),
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
      week_code: report.week_code,
      sort_order: Number(it.sort_order) || 0,
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

  return sortable
    .map((s) => s.row)
    .filter((row) => row.work_days > 0)
}

/** 个人考勤明细：当前用户全部项目，周次列带「（MM/DD~MM/DD）」 */
export async function getMyAttendanceDetails(
  userId: string,
  yearMonth: string
): Promise<AttendanceDetailRow[]> {
  const supabase = createAdminClient()
  const { monthStart, monthEnd } = parseYearMonth(yearMonth)

  const weekRows = await getWeekCodesOverlappingMonth(supabase, monthStart, monthEnd)
  const weekCodes = weekRows.map((w) => w.week_code)
  const weekMeta = new Map(
    weekRows.map((w) => [
      w.week_code,
      { start: w.start_date, end: w.end_date },
    ])
  )
  if (!weekCodes.length) return []

  // 直接从 items 出发，用 !inner join 在数据库侧过滤，避免把大量 reportIds 拼入 URL
  const { data: items, error: iErr } = await supabase
    .from('weekly_report_items')
    .select('id, item_desc, work_days, work_dates, item_type, sort_order, weekly_reports!inner(user_id, project_id, week_code, status)')
    .eq('weekly_reports.user_id', userId)
    .in('weekly_reports.week_code', weekCodes)
    .neq('weekly_reports.status', 'draft')
    .eq('item_type', 'work')
    .order('sort_order', { ascending: true })

  if (iErr) handleDbError(iErr)

  const { data: userRow, error: uErr } = await supabase
    .from('users')
    .select('id, name, employee_no')
    .eq('id', userId)
    .maybeSingle()
  if (uErr) handleDbError(uErr)
  const un = userRow?.name?.trim() || '—'
  const eno = userRow?.employee_no?.trim() ?? null

  const seenProjIds = new Set<string>()
  for (const it of items ?? []) {
    const report = it.weekly_reports as unknown as ReportMeta | null
    if (report) seenProjIds.add(report.project_id)
  }

  const projName = new Map<string, string | null>()
  if (seenProjIds.size) {
    const { data: projRows, error: pErr } = await supabase
      .from('projects')
      .select('id, project_name')
      .in('id', [...seenProjIds])
    if (pErr) handleDbError(pErr)
    for (const p of projRows ?? []) projName.set(p.id, p.project_name)
  }

  const itemList = items ?? []
  type Sortable = {
    row: AttendanceDetailRow
    week_code: string
    sort_order: number
    project_name: string | null
  }
  const sortable: Sortable[] = itemList.map((it) => {
    const report = it.weekly_reports as unknown as ReportMeta | null
    if (!report) {
      return {
        row: {
          id: String(it.id ?? ''),
          user_name: '—',
          employee_no: null,
          project_name: null,
          week_label: '—',
          work_content: '—',
          date_range: '—',
          work_days: 0,
          original_work_days: 0,
        },
        week_code: '',
        sort_order: 0,
        project_name: null,
      }
    }
    const wm = weekMeta.get(report.week_code)
    const desc = (it.item_desc as string | null)?.trim()
    const content = desc ? desc : '—'
    const slots = parseWorkDatesJson(it.work_dates)
    const dr = formatWorkSlotsBriefZh(slots)
    const { attributed, original } = attributedWorkDaysInMonth(
      it,
      wm?.start ?? null,
      wm?.end ?? null,
      monthStart,
      monthEnd
    )

    const weekTitle = formatWeekTitleZh(report.week_code)
    const rangeLine =
      wm?.start?.trim() && wm?.end?.trim()
        ? formatWeekRangeLine(wm.start.trim(), wm.end.trim())
        : ''
    const week_label = rangeLine !== '' ? `${weekTitle}（${rangeLine}）` : weekTitle

    const pn = projName.get(report.project_id) ?? null

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
      week_code: report.week_code,
      sort_order: Number(it.sort_order) || 0,
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

  return sortable
    .map((s) => s.row)
    .filter((row) => row.work_days > 0)
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
