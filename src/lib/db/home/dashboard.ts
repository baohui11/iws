import { createAdminClient } from '@/lib/supabase/admin'
import { handleDbError } from '@/lib/db/handle-db-error'
import { getMyMonthWorkDaysTotal } from '@/lib/db/stats/attendance-stats'
import {
  getPmPendingApprovalCount,
  isPmOnAnyProject,
} from '@/lib/db/weekly/reports'
import { getCurrentWeekCode } from '@/lib/utils/iso-week'
import { getYearMonthOfCurrentWeek } from '@/lib/utils/stats-year-month'
import type { HomeDashboardData, HomeFileActivityRow } from '@/types/home'

async function countUserProjects(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('project_members')
    .select('project_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('deleted_at', null)

  if (error) handleDbError(error)
  return count ?? 0
}

async function countUserWeekReports(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  weekCode: string
): Promise<number> {
  const { count, error } = await supabase
    .from('weekly_reports')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('week_code', weekCode)
    .neq('status', 'draft')

  if (error) handleDbError(error)
  return count ?? 0
}

async function countUserFileUploads(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('files')
    .select('id', { count: 'exact', head: true })
    .eq('uploader_id', userId)
    .eq('is_latest', true)

  if (error) handleDbError(error)
  return count ?? 0
}

async function countUserFileInteractions(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  interactionType: 'favorite' | 'recommend'
): Promise<number> {
  const { count, error } = await supabase
    .from('file_interactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('interaction_type', interactionType)

  if (error) handleDbError(error)
  return count ?? 0
}

async function loadFileActivityFeed(
  supabase: ReturnType<typeof createAdminClient>,
  limit: number
): Promise<HomeFileActivityRow[]> {
  const { data: uploadRows, error: uErr } = await supabase
    .from('files')
    .select('id, created_at, file_name, uploader_id, project_id')
    .eq('is_latest', true)
    .order('created_at', { ascending: false })
    .limit(24)

  if (uErr) handleDbError(uErr)

  const { data: recRows, error: rErr } = await supabase
    .from('file_interactions')
    .select('id, created_at, user_id, file_id')
    .eq('interaction_type', 'recommend')
    .order('created_at', { ascending: false })
    .limit(24)

  if (rErr) handleDbError(rErr)

  const userIds = new Set<string>()
  const projectIds = new Set<string>()
  for (const r of uploadRows ?? []) {
    if (r.uploader_id) userIds.add(r.uploader_id as string)
    if (r.project_id) projectIds.add(r.project_id as string)
  }
  for (const r of recRows ?? []) {
    if (r.user_id) userIds.add(r.user_id as string)
  }

  const fileIds = (recRows ?? [])
    .map((r) => r.file_id as string)
    .filter(Boolean)
  let fileMeta = new Map<
    string,
    { file_name: string | null; project_id: string | null }
  >()
  if (fileIds.length) {
    const { data: files, error: fErr } = await supabase
      .from('files')
      .select('id, file_name, project_id')
      .in('id', fileIds)
    if (fErr) handleDbError(fErr)
    for (const f of files ?? []) {
      fileMeta.set(f.id as string, {
        file_name: f.file_name,
        project_id: f.project_id as string | null,
      })
      if (f.project_id) projectIds.add(f.project_id as string)
    }
  }

  const userName = new Map<string, string>()
  if (userIds.size) {
    const { data: users, error: usrErr } = await supabase
      .from('users')
      .select('id, name')
      .in('id', [...userIds])
    if (usrErr) handleDbError(usrErr)
    for (const u of users ?? []) {
      userName.set(u.id as string, u.name?.trim() || '—')
    }
  }

  const projName = new Map<string, string | null>()
  if (projectIds.size) {
    const { data: projs, error: pErr } = await supabase
      .from('projects')
      .select('id, project_name')
      .in('id', [...projectIds])
    if (pErr) handleDbError(pErr)
    for (const p of projs ?? []) {
      projName.set(p.id as string, (p.project_name as string) ?? null)
    }
  }

  const merged: HomeFileActivityRow[] = []

  for (const r of uploadRows ?? []) {
    const uid = r.uploader_id as string
    const pid = r.project_id as string | null
    const ca = r.created_at != null ? String(r.created_at) : ''
    merged.push({
      id: `u-${r.id}`,
      kind: 'upload',
      at: ca,
      actorName: userName.get(uid) ?? '—',
      fileName: (r.file_name as string) ?? '—',
      fileId: r.id as string,
      projectName: pid ? projName.get(pid) ?? null : null,
    })
  }

  for (const r of recRows ?? []) {
    const fid = r.file_id as string
    const meta = fileMeta.get(fid)
    const uid = r.user_id as string
    const ca = r.created_at != null ? String(r.created_at) : ''
    const pid = meta?.project_id ?? null
    merged.push({
      id: `r-${r.id}`,
      kind: 'recommend',
      at: ca,
      actorName: userName.get(uid) ?? '—',
      fileName: meta?.file_name ?? '—',
      fileId: fid,
      projectName: pid ? projName.get(pid) ?? null : null,
    })
  }

  merged.sort((a, b) => (b.at || '').localeCompare(a.at || ''))
  return merged.slice(0, limit)
}

export async function getHomeDashboardData(userId: string): Promise<HomeDashboardData> {
  const supabase = createAdminClient()
  const weekCode = getCurrentWeekCode()
  const ym = getYearMonthOfCurrentWeek()

  const [
    projectCount,
    currentWeekReportCount,
    monthWorkDays,
    fileUploadCount,
    fileFavoriteCount,
    fileRecommendCount,
    fileActivity,
    pmPendingCount,
    isPm,
  ] = await Promise.all([
    countUserProjects(supabase, userId),
    countUserWeekReports(supabase, userId, weekCode),
    getMyMonthWorkDaysTotal(userId, ym),
    countUserFileUploads(supabase, userId),
    countUserFileInteractions(supabase, userId, 'favorite'),
    countUserFileInteractions(supabase, userId, 'recommend'),
    loadFileActivityFeed(supabase, 10),
    getPmPendingApprovalCount(userId),
    isPmOnAnyProject(userId),
  ])

  return {
    projectCount,
    currentWeekReportCount,
    monthWorkDays,
    fileUploadCount,
    fileFavoriteCount,
    fileRecommendCount,
    fileActivity,
    pmPendingCount,
    isPm,
  }
}
