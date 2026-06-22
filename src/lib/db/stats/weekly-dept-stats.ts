import { createAdminClient } from '@/lib/supabase/admin'
import { getDepartmentIdsForListFilter } from '@/lib/db/admin/departments'
import { handleDbError } from '@/lib/db/handle-db-error'
import { compareWeekCode } from '@/lib/utils/iso-week'
import { WEEKLY_REPORT_STATUS_LABEL } from '@/constants/weekly-report-status'
import type {
  WeeklyDeptByPersonRow,
  WeeklyDeptByProjectRow,
  WeeklyDeptDetailRow,
} from '@/types/stats'
type WeeklyReportStatus = 'draft' | 'pending' | 'approved' | 'rejected'

function weekCoveredByExemptions(
  weekCode: string,
  rows: { start_week_code: string; end_week_code: string | null }[]
): boolean {
  const w = weekCode.trim()
  for (const row of rows) {
    const start = row.start_week_code?.trim() ?? ''
    const end = (row.end_week_code?.trim() || start) as string
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

type ReportLite = {
  id: string
  user_id: string
  project_id: string
  status: WeeklyReportStatus
  created_at: string | null
}

export interface WeeklyDeptStatsParams {
  departmentId: string
  weekCode: string
  personNameKeyword?: string | null
  projectKeyword?: string | null
}

async function getProjectIdsInDepartmentScope(departmentId: string): Promise<string[]> {
  const supabase = createAdminClient()
  const deptIds = await getDepartmentIdsForListFilter(departmentId)
  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .in('department_id', deptIds)
    .is('deleted_at', null)

  if (error) handleDbError(error)
  return (data ?? []).map((r) => r.id).filter(Boolean) as string[]
}

async function getWeekDateRange(weekCode: string): Promise<{
  start: string
  end: string
} | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('weeks')
    .select('start_date, end_date')
    .eq('week_code', weekCode.trim())
    .maybeSingle()

  if (error) handleDbError(error)
  const s = data?.start_date
  const e = data?.end_date
  if (!s || !e) return null
  return { start: String(s), end: String(e) }
}

/** 按人员：部门在职人员每人一行 */
export async function getWeeklyDeptByPerson(
  params: WeeklyDeptStatsParams
): Promise<WeeklyDeptByPersonRow[]> {
  const supabase = createAdminClient()
  const weekCode = params.weekCode.trim()
  const deptIds = await getDepartmentIdsForListFilter(params.departmentId)
  let projectIds = await getProjectIdsInDepartmentScope(params.departmentId)
  if (!projectIds.length) return []

  const pk = params.projectKeyword?.trim()
  if (pk) {
    const { data: matchProj, error: mpErr } = await supabase
      .from('projects')
      .select('id')
      .in('id', projectIds)
      .or(`project_name.ilike.%${pk}%,project_no.ilike.%${pk}%`)

    if (mpErr) handleDbError(mpErr)
    projectIds = (matchProj ?? []).map((r) => r.id as string)
    if (!projectIds.length) return []
  }

  const dateRange = await getWeekDateRange(weekCode)
  if (!dateRange) return []

  let userQ = supabase
    .from('users')
    .select('id, name')
    .in('department_id', deptIds)
    .is('deleted_at', null)

  const kw = params.personNameKeyword?.trim()
  if (kw) {
    userQ = userQ.ilike('name', `%${kw}%`)
  }

  const { data: userRows, error: uErr } = await userQ.order('name', { ascending: true })
  if (uErr) handleDbError(uErr)
  const users = (userRows ?? []) as { id: string; name: string | null }[]

  const { data: pmRows, error: pmErr } = await supabase
    .from('project_members')
    .select('user_id, project_id')
    .in('project_id', projectIds)
    .is('deleted_at', null)

  if (pmErr) handleDbError(pmErr)

  const userHasDeptProject = new Set<string>()
  for (const r of pmRows ?? []) {
    if (r.user_id && r.project_id && projectIds.includes(r.project_id)) {
      userHasDeptProject.add(r.user_id)
    }
  }

  const { data: reportRows, error: rErr } = await supabase
    .from('weekly_reports')
    .select('id, user_id, project_id, status, created_at')
    .eq('week_code', weekCode)
    .in('project_id', projectIds)
    .neq('status', 'draft')

  if (rErr) handleDbError(rErr)
  const reports = (reportRows ?? []) as ReportLite[]

  const reportIds = reports.map((r) => r.id)
  const hoursByReport = new Map<string, number>()
  if (reportIds.length) {
    const { data: items, error: iErr } = await supabase
      .from('weekly_report_items')
      .select('report_id, work_days, item_type')
      .in('report_id', reportIds)

    if (iErr) handleDbError(iErr)
    for (const it of items ?? []) {
      if (it.item_type !== 'work') continue
      const rid = it.report_id as string
      const d = it.work_days != null ? Number(it.work_days) : 0
      hoursByReport.set(rid, (hoursByReport.get(rid) ?? 0) + d * 8)
    }
  }

  const reportsByUser = new Map<string, ReportLite[]>()
  for (const rep of reports) {
    const list = reportsByUser.get(rep.user_id) ?? []
    list.push(rep)
    reportsByUser.set(rep.user_id, list)
  }

  const { data: fileRows, error: fErr } = await supabase
    .from('files')
    .select('id, uploader_id, project_id, created_at')
    .in('project_id', projectIds)
    .gte('created_at', `${dateRange.start}T00:00:00`)
    .lte('created_at', `${dateRange.end}T23:59:59.999`)

  if (fErr) handleDbError(fErr)

  const fileCountByUser = new Map<string, number>()
  for (const f of fileRows ?? []) {
    const uid = f.uploader_id as string
    if (!uid) continue
    fileCountByUser.set(uid, (fileCountByUser.get(uid) ?? 0) + 1)
  }

  return users.map((u) => {
    const list = reportsByUser.get(u.id) ?? []
    const has_report = list.length > 0
    let workHours = 0
    const projSet = new Set<string>()
    for (const rep of list) {
      workHours += hoursByReport.get(rep.id) ?? 0
      projSet.add(rep.project_id)
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

/** 按项目：进行中 + 暂停 */
export async function getWeeklyDeptByProject(
  params: WeeklyDeptStatsParams
): Promise<WeeklyDeptByProjectRow[]> {
  const supabase = createAdminClient()
  const weekCode = params.weekCode.trim()
  const deptIds = await getDepartmentIdsForListFilter(params.departmentId)

  let pq = supabase
    .from('projects')
    .select('id, project_no, project_name, project_status')
    .in('department_id', deptIds)
    .in('project_status', ['active', 'suspended'])
    .is('deleted_at', null)

  const pk = params.projectKeyword?.trim()
  if (pk) {
    pq = pq.or(`project_name.ilike.%${pk}%,project_no.ilike.%${pk}%`)
  }

  const { data: projects, error: pErr } = await pq.order('project_no', { ascending: true })
  if (pErr) handleDbError(pErr)
  const plist = (projects ?? []) as {
    id: string
    project_no: string | null
    project_name: string | null
    project_status: string | null
  }[]
  if (!plist.length) return []

  const projectIds = plist.map((p) => p.id)

  const { data: exRows, error: exErr } = await supabase
    .from('project_week_exemptions')
    .select('project_id, start_week_code, end_week_code')
    .in('project_id', projectIds)

  if (exErr) handleDbError(exErr)
  const exByProject = new Map<
    string,
    { start_week_code: string; end_week_code: string | null }[]
  >()
  for (const row of exRows ?? []) {
    const pid = row.project_id as string
    const list = exByProject.get(pid) ?? []
    list.push({
      start_week_code: row.start_week_code,
      end_week_code: row.end_week_code,
    })
    exByProject.set(pid, list)
  }

  const { data: reportRows, error: rErr } = await supabase
    .from('weekly_reports')
    .select('id, project_id, status')
    .eq('week_code', weekCode)
    .in('project_id', projectIds)
    .neq('status', 'draft')

  if (rErr) handleDbError(rErr)
  const reports = (reportRows ?? []) as {
    id: string
    project_id: string
    status: WeeklyReportStatus
  }[]

  const reportIds = reports.map((r) => r.id)
  const hoursByReport = new Map<string, number>()
  if (reportIds.length) {
    const { data: items, error: iErr } = await supabase
      .from('weekly_report_items')
      .select('report_id, work_days, item_type')
      .in('report_id', reportIds)

    if (iErr) handleDbError(iErr)
    for (const it of items ?? []) {
      if (it.item_type !== 'work') continue
      const rid = it.report_id as string
      const d = it.work_days != null ? Number(it.work_days) : 0
      hoursByReport.set(rid, (hoursByReport.get(rid) ?? 0) + d * 8)
    }
  }

  const byProject = new Map<string, typeof reports>()
  for (const r of reports) {
    const list = byProject.get(r.project_id) ?? []
    list.push(r)
    byProject.set(r.project_id, list)
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
      project_no: p.project_no,
      project_name: p.project_name,
      project_status: p.project_status,
      no_work_exemption: weekCoveredByExemptions(
        weekCode,
        exByProject.get(p.id) ?? []
      ),
      report_count: list.length,
      pending_count: pending,
      total_work_days: hoursToWorkDays(totalH),
    }
  })
}

/** 周报明细 */
export async function getWeeklyDeptDetails(
  params: WeeklyDeptStatsParams
): Promise<WeeklyDeptDetailRow[]> {
  const supabase = createAdminClient()
  const weekCode = params.weekCode.trim()
  const projectIds = await getProjectIdsInDepartmentScope(params.departmentId)
  if (!projectIds.length) return []

  let rq = supabase
    .from('weekly_reports')
    .select('id, user_id, project_id, week_code, status, created_at')
    .eq('week_code', weekCode)
    .in('project_id', projectIds)
    .neq('status', 'draft')

  const pk = params.projectKeyword?.trim()
  if (pk) {
    const { data: matchProj, error: mpErr } = await supabase
      .from('projects')
      .select('id')
      .in('id', projectIds)
      .or(`project_name.ilike.%${pk}%,project_no.ilike.%${pk}%`)

    if (mpErr) handleDbError(mpErr)
    const mids = (matchProj ?? []).map((r) => r.id as string)
    if (!mids.length) return []
    rq = rq.in('project_id', mids)
  }

  const pn = params.personNameKeyword?.trim()
  if (pn) {
    const { data: matchUsers, error: muErr } = await supabase
      .from('users')
      .select('id')
      .ilike('name', `%${pn}%`)

    if (muErr) handleDbError(muErr)
    const uids = (matchUsers ?? []).map((r) => r.id as string)
    if (!uids.length) return []
    rq = rq.in('user_id', uids)
  }

  const { data: reportRows, error: rErr } = await rq.order('created_at', { ascending: false })
  if (rErr) handleDbError(rErr)
  const reports = (reportRows ?? []) as (ReportLite & {
    week_code: string
  })[]
  if (!reports.length) return []

  const reportIds = reports.map((r) => r.id)
  const hoursByReport = new Map<string, number>()
  const countByReport = new Map<string, number>()
  const { data: items, error: iErr } = await supabase
    .from('weekly_report_items')
    .select('report_id, work_days, item_type')
    .in('report_id', reportIds)

  if (iErr) handleDbError(iErr)
  for (const it of items ?? []) {
    const rid = it.report_id as string
    countByReport.set(rid, (countByReport.get(rid) ?? 0) + 1)
    if (it.item_type !== 'work') continue
    const d = it.work_days != null ? Number(it.work_days) : 0
    hoursByReport.set(rid, (hoursByReport.get(rid) ?? 0) + d * 8)
  }

  const userIds = [...new Set(reports.map((r) => r.user_id))]
  const projIds = [...new Set(reports.map((r) => r.project_id))]

  const { data: users, error: uErr } = await supabase
    .from('users')
    .select('id, name')
    .in('id', userIds)
  if (uErr) handleDbError(uErr)
  const userName = new Map((users ?? []).map((u) => [u.id, u.name?.trim() || '—']))

  const { data: projs, error: pErr } = await supabase
    .from('projects')
    .select('id, project_no, project_name')
    .in('id', projIds)
  if (pErr) handleDbError(pErr)
  const projNo = new Map((projs ?? []).map((p) => [p.id, p.project_no]))
  const projName = new Map((projs ?? []).map((p) => [p.id, p.project_name]))

  const { data: apprRows, error: aErr } = await supabase
    .from('weekly_report_approvals')
    .select('report_id, created_at')
    .in('report_id', reportIds)

  if (aErr) handleDbError(aErr)
  const approvedAtByReport = new Map<string, string>()
  for (const a of apprRows ?? []) {
    const rid = a.report_id as string
    const ca = a.created_at != null ? String(a.created_at) : ''
    const prev = approvedAtByReport.get(rid)
    if (!prev || ca > prev) {
      approvedAtByReport.set(rid, ca)
    }
  }

  return reports.map((r) => {
    const st = r.status
    const label =
      WEEKLY_REPORT_STATUS_LABEL[st as keyof typeof WEEKLY_REPORT_STATUS_LABEL] ?? st
    const th = hoursByReport.get(r.id) ?? 0
    const submitted =
      st !== 'draft' && r.created_at ? String(r.created_at).slice(0, 19).replace('T', ' ') : null
    const appr = approvedAtByReport.get(r.id)
    const approved_at = appr
      ? appr.slice(0, 19).replace('T', ' ')
      : null

    return {
      report_id: r.id,
      user_id: r.user_id,
      user_name: userName.get(r.user_id) ?? '—',
      project_id: r.project_id,
      project_no: projNo.get(r.project_id) ?? null,
      project_name: projName.get(r.project_id) ?? null,
      week_code: r.week_code,
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
