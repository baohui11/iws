import {
  formatWeekRangeLine,
  formatWeekTitleZh,
  isTodayInWeekRange,
} from '@/lib/utils/week-display'
import { WEEKLY_REPORTS_PAGE_SIZE } from '@/constants/weekly-reports-list'
import { createClient } from '@/lib/supabase/server'
import { handleDbError } from '@/lib/db/handle-db-error'
import { compareWeekCode, getCurrentWeekCode } from '@/lib/utils/iso-week'
import type {
  MemberProjectOption,
  MyFilledReportRow,
  MyFilledReportsPaged,
  MyFilledReportsParams,
  PmApprovalListPaged,
  PmApprovalListParams,
  PmApprovalListRow,
  WeekOption,
} from '@/types/weekly-reports'

export type {
  ApprovalDoneFilter,
  MemberProjectOption,
  MyFilledGroupView,
  MyFilledReportRow,
  MyFilledReportsPaged,
  MyFilledReportsParams,
  PmApprovalListPaged,
  PmApprovalListParams,
  PmApprovalListRow,
  WeekOption,
} from '@/types/weekly-reports'

export { WEEKLY_REPORTS_PAGE_SIZE } from '@/constants/weekly-reports-list'

type ServerClient = Awaited<ReturnType<typeof createClient>>

async function fetchMemberProjectIds(
  supabase: ServerClient,
  userId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('user_id', userId)
    .is('deleted_at', null)

  if (error) handleDbError(error)
  const ids = (data ?? [])
    .map((r) => r.project_id)
    .filter((id): id is string => id != null)
  return [...new Set(ids)]
}

async function fetchPmProjectIds(
  supabase: ServerClient,
  userId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('user_id', userId)
    .eq('project_role', 'pm')
    .is('deleted_at', null)

  if (error) handleDbError(error)
  const ids = (data ?? [])
    .map((r) => r.project_id)
    .filter((id): id is string => id != null)
  return [...new Set(ids)]
}

/** 项目是否配置了项目经理（用于周报审批：无 PM 则提交后直接为已审批） */
export async function projectHasPm(projectId: string): Promise<boolean> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('project_members')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('project_role', 'pm')
    .is('deleted_at', null)

  if (error) handleDbError(error)
  return (count ?? 0) > 0
}

export function mapProjectRowWithDepartment(
  r: Record<string, unknown>
): MemberProjectOption {
  return {
    id: r.id as string,
    project_no: r.project_no as string | null,
    project_name: r.project_name as string | null,
    department_id: (r.department_id as string | null) ?? null,
    department_name:
      (r.department_name as unknown as { name: string } | null)?.name ?? null,
  }
}

export async function getMemberProjectsForWeeklyFilter(
  userId: string
): Promise<MemberProjectOption[]> {
  const supabase = await createClient()
  const projectIds = await fetchMemberProjectIds(supabase, userId)
  if (!projectIds.length) return []

  const { data, error } = await supabase
    .from('projects')
    .select('id, project_no, project_name, department_id, department_name:departments(name)')
    .in('id', projectIds)
    .is('deleted_at', null)
    .or('project_status.in.(active,completed,suspended),project_status.is.null')
    .order('project_no', { ascending: true })

  if (error) handleDbError(error)
  return (data ?? []).map((r) => mapProjectRowWithDepartment(r as Record<string, unknown>))
}

export async function getPmProjectsForFilter(userId: string): Promise<MemberProjectOption[]> {
  const supabase = await createClient()
  const projectIds = await fetchPmProjectIds(supabase, userId)
  if (!projectIds.length) return []

  const { data, error } = await supabase
    .from('projects')
    .select('id, project_no, project_name, department_id, department_name:departments(name)')
    .in('id', projectIds)
    .is('deleted_at', null)
    .or('project_status.in.(active,completed,suspended),project_status.is.null')
    .order('project_no', { ascending: true })

  if (error) handleDbError(error)
  return (data ?? []).map((r) => mapProjectRowWithDepartment(r as Record<string, unknown>))
}

/** 周次选项：仅 weeks 表；副标题为库中起止日；本周按日历判断是否在周内 */
export async function getWeekOptionsUpToCurrent(limit = 104): Promise<WeekOption[]> {
  const supabase = await createClient()

  const today = new Date().toISOString().slice(0, 10)
  const { data: rows, error } = await supabase
    .from('weeks')
    .select('week_code, start_date, end_date')
    .lte('start_date', today)
    .order('end_date', { ascending: false })
    .limit(limit)

  if (error) handleDbError(error)

  return (rows ?? []).map((r) => {
    const week_code = r.week_code
    const start = r.start_date ?? null
    const end = r.end_date ?? null
    return {
      week_code,
      title_zh: formatWeekTitleZh(week_code),
      range_line: formatWeekRangeLine(start, end),
      start_date: start,
      end_date: end,
      is_current: isTodayInWeekRange(start, end),
    }
  })
}

export async function getMyFilledReportsWithStats(
  params: MyFilledReportsParams
): Promise<MyFilledReportsPaged> {
  const supabase = await createClient()
  const { userId, weekCodes, projectIds } = params
  const offset = Math.max(0, params.offset ?? 0)
  const limit = Math.min(Math.max(1, params.limit ?? WEEKLY_REPORTS_PAGE_SIZE), 100)

  const memberIds = await fetchMemberProjectIds(supabase, userId)
  if (!memberIds.length) return { rows: [], total: 0 }

  const projectScope = projectIds.length
    ? projectIds.filter((id) => memberIds.includes(id))
    : memberIds
  if (!projectScope.length) return { rows: [], total: 0 }

  const buildBaseFilter = () => {
    let q = supabase
      .from('weekly_reports')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('project_id', projectScope)

    if (weekCodes.length) {
      const current = getCurrentWeekCode()
      const capped = weekCodes.filter((w) => compareWeekCode(w, current) <= 0)
      if (!capped.length) return null
      q = q.in('week_code', capped)
    }
    return q
  }

  const countQ = buildBaseFilter()
  if (!countQ) return { rows: [], total: 0 }

  const { count: totalCount, error: countErr } = await countQ
  if (countErr) handleDbError(countErr)
  const total = totalCount ?? 0
  if (total === 0) return { rows: [], total: 0 }

  let dataQ = supabase
    .from('weekly_reports')
    .select('id, project_id, week_code, status')
    .eq('user_id', userId)
    .in('project_id', projectScope)

  if (weekCodes.length) {
    const current = getCurrentWeekCode()
    const capped = weekCodes.filter((w) => compareWeekCode(w, current) <= 0)
    if (!capped.length) return { rows: [], total: 0 }
    dataQ = dataQ.in('week_code', capped)
  }

  dataQ = dataQ
    .order('week_code', { ascending: false })
    .order('project_id', { ascending: true })
    .range(offset, offset + limit - 1)

  const { data: reports, error } = await dataQ
  if (error) handleDbError(error)
  const list = reports ?? []
  if (!list.length) return { rows: [], total }

  const reportIds = list.map((r) => r.id)
  const { data: items, error: itemErr } = await supabase
    .from('weekly_report_items')
    .select('report_id, work_days, item_type')
    .in('report_id', reportIds)

  if (itemErr) handleDbError(itemErr)

  const countBy = new Map<string, number>()
  const daysBy = new Map<string, number>()
  for (const it of items ?? []) {
    const rid = it.report_id
    countBy.set(rid, (countBy.get(rid) ?? 0) + 1)
    if (it.item_type !== 'work') continue
    const d = it.work_days != null ? Number(it.work_days) : 0
    daysBy.set(rid, (daysBy.get(rid) ?? 0) + d)
  }

  const projIds = [...new Set(list.map((r) => r.project_id))]
  const { data: projects, error: pErr } = await supabase
    .from('projects')
    .select('id, project_name')
    .in('id', projIds)
  if (pErr) handleDbError(pErr)
  const nameBy = new Map((projects ?? []).map((p) => [p.id, p.project_name]))

  const rows: MyFilledReportRow[] = list.map((r) => {
    const td = daysBy.get(r.id) ?? 0
    const th = td * 8
    return {
      id: r.id,
      project_id: r.project_id,
      week_code: r.week_code,
      status: r.status,
      project_name: nameBy.get(r.project_id) ?? null,
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
  const supabase = await createClient()
  const { userId, approvalFilter, weekCodes, projectIds } = params
  const offset = Math.max(0, params.offset ?? 0)
  const limit = Math.min(Math.max(1, params.limit ?? WEEKLY_REPORTS_PAGE_SIZE), 100)

  const pmIds = await fetchPmProjectIds(supabase, userId)
  if (!pmIds.length) return { rows: [], total: 0 }

  const projectScope = projectIds.length
    ? projectIds.filter((id) => pmIds.includes(id))
    : pmIds
  if (!projectScope.length) return { rows: [], total: 0 }

  let q = supabase
    .from('weekly_reports')
    .select('id, user_id, project_id, week_code, status, submit_time')
    .neq('user_id', userId)
    .in('project_id', projectScope)
    .neq('status', 'draft')

  if (weekCodes.length) {
    const current = getCurrentWeekCode()
    const capped = weekCodes.filter((w) => compareWeekCode(w, current) <= 0)
    if (!capped.length) return { rows: [], total: 0 }
    q = q.in('week_code', capped)
  }

  const { data: reports, error } = await q
  if (error) handleDbError(error)
  let list = reports ?? []
  if (!list.length) return { rows: [], total: 0 }

  const reportIds = list.map((r) => r.id)
  const submitTimeByReport = new Map(
    (list as { id: string; submit_time: string | null }[]).map((r) => [
      r.id,
      r.submit_time,
    ])
  )

  const { data: myApprovals, error: aErr } = await supabase
    .from('weekly_report_approvals')
    .select('report_id, approved_at, created_at')
    .eq('approver_id', userId)
    .in('report_id', reportIds)

  if (aErr) handleDbError(aErr)

  const approvedSet = new Set<string>()
  for (const a of myApprovals ?? []) {
    const rid = a.report_id as string
    const st = submitTimeByReport.get(rid)
    if (!st) continue
    const threshold = new Date(st).getTime()
    if (Number.isNaN(threshold)) continue
    const t =
      a.approved_at != null
        ? new Date(a.approved_at).getTime()
        : new Date(a.created_at).getTime()
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

  const userIds = [...new Set(list.map((r) => r.user_id))]
  const projIds = [...new Set(list.map((r) => r.project_id))]

  const { data: users, error: uErr } = await supabase
    .from('users')
    .select('id, name')
    .in('id', userIds)
  if (uErr) handleDbError(uErr)
  const userName = new Map((users ?? []).map((u) => [u.id, u.name?.trim() || '—']))

  const { data: projects, error: pErr } = await supabase
    .from('projects')
    .select('id, project_name')
    .in('id', projIds)
  if (pErr) handleDbError(pErr)
  const projName = new Map((projects ?? []).map((p) => [p.id, p.project_name]))

  const out: PmApprovalListRow[] = list.map((r) => ({
    id: r.id,
    project_id: r.project_id,
    week_code: r.week_code,
    status: r.status,
    project_name: projName.get(r.project_id) ?? null,
    author_name: userName.get(r.user_id) ?? '—',
    author_id: r.user_id,
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

/** 作为项目经理待审批条数（status=pending，且非本人周报） */
export async function getPmPendingApprovalCount(userId: string): Promise<number> {
  const supabase = await createClient()
  const pmIds = await fetchPmProjectIds(supabase, userId)
  if (!pmIds.length) return 0

  const { count, error } = await supabase
    .from('weekly_reports')
    .select('id', { count: 'exact', head: true })
    .neq('user_id', userId)
    .in('project_id', pmIds)
    .eq('status', 'pending')

  if (error) handleDbError(error)
  return count ?? 0
}

/** 是否至少担任一个项目的项目经理（周报审批、无工作管理等入口） */
export async function isPmOnAnyProject(userId: string): Promise<boolean> {
  const supabase = await createClient()
  const pmIds = await fetchPmProjectIds(supabase, userId)
  return pmIds.length > 0
}

/** 当前用户担任项目经理的项目 id（周报审批权限） */
export async function getPmProjectIdsForUser(userId: string): Promise<string[]> {
  const supabase = await createClient()
  return fetchPmProjectIds(supabase, userId)
}
