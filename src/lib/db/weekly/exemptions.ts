import { createClient } from '@/lib/supabase/server'
import { mapProjectRowWithDepartment } from '@/lib/db/weekly/reports'
import { handleDbError } from '@/lib/db/handle-db-error'
import { BusinessError } from '@/lib/errors'
import {
  compareWeekCode,
  formatWeekCodeLabelZh,
  parseWeekCode,
  weekCodesInclusiveRange,
} from '@/lib/utils/iso-week'
import type {
  MemberProjectOption,
  ProjectWeekExemptionListRow,
} from '@/types/weekly-reports'

type ServerClient = Awaited<ReturnType<typeof createClient>>

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

/** 当前用户是否为指定项目的项目经理 */
export async function isUserPmForProject(
  userId: string,
  projectId: string
): Promise<boolean> {
  const supabase = await createClient()
  const ids = await fetchPmProjectIds(supabase, userId)
  return ids.includes(projectId)
}

function expandExemptionRowWeeks(
  start: string,
  end: string | null
): string[] {
  const s = start.trim()
  const e = (end?.trim() || s) as string
  if (compareWeekCode(s, e) > 0) return []
  return weekCodesInclusiveRange(s, e)
}

/**
 * 指定项目、周次是否落在 `project_week_exemptions` 某条记录的区间内（含起止周）。
 * 成员在该周不可新建/编辑/提交该项目周报。
 */
export async function isProjectWeekExempt(
  projectId: string,
  weekCode: string
): Promise<boolean> {
  const supabase = await createClient()
  const w = weekCode.trim()
  if (!w) return false

  const { data, error } = await supabase
    .from('project_week_exemptions')
    .select('start_week_code, end_week_code')
    .eq('project_id', projectId)

  if (error) handleDbError(error)
  for (const row of data ?? []) {
    const start = row.start_week_code?.trim() ?? ''
    const end = (row.end_week_code?.trim() || start) as string
    if (!start) continue
    if (compareWeekCode(w, start) >= 0 && compareWeekCode(w, end) <= 0) {
      return true
    }
  }
  return false
}

/** 与已有无工作区间是否有周次重叠 */
function rangesOverlapWeeks(
  aStart: string,
  aEnd: string | null,
  bWeeks: Set<string>
): boolean {
  const aWeeks = new Set(expandExemptionRowWeeks(aStart, aEnd))
  for (const w of bWeeks) {
    if (aWeeks.has(w)) return true
  }
  return false
}

/**
 * 指定项目、周次列表内是否存在非草稿周报（任意成员）
 */
export async function findProjectWeeksWithExistingReports(
  projectId: string,
  weekCodes: string[]
): Promise<string[]> {
  if (!weekCodes.length) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('weekly_reports')
    .select('week_code')
    .eq('project_id', projectId)
    .in('week_code', weekCodes)
    .neq('status', 'draft')

  if (error) handleDbError(error)
  const set = new Set((data ?? []).map((r) => r.week_code))
  return [...set].sort((a, b) => compareWeekCode(a, b))
}

export async function listPmProjectWeekExemptions(
  userId: string
): Promise<ProjectWeekExemptionListRow[]> {
  const supabase = await createClient()
  const pmIds = await fetchPmProjectIds(supabase, userId)
  if (!pmIds.length) return []

  const { data: rows, error } = await supabase
    .from('project_week_exemptions')
    .select('id, project_id, start_week_code, end_week_code, created_at, created_by')
    .in('project_id', pmIds)
    .order('created_at', { ascending: false })

  if (error) handleDbError(error)
  if (!rows?.length) return []

  const projIds = [...new Set(rows.map((r) => r.project_id))]
  const { data: projects, error: pe } = await supabase
    .from('projects')
    .select('id, project_name')
    .in('id', projIds)

  if (pe) handleDbError(pe)
  const nameBy = new Map((projects ?? []).map((p) => [p.id, p.project_name]))

  return rows.map((r) => ({
    id: r.id,
    project_id: r.project_id,
    project_name: nameBy.get(r.project_id) ?? null,
    start_week_code: r.start_week_code,
    end_week_code: r.end_week_code,
    created_at: r.created_at,
    created_by: r.created_by,
  }))
}

export interface InsertPmProjectWeekExemptionInput {
  userId: string
  projectId: string
  /** 单周，入库时 start_week_code 与 end_week_code 均写入该值 */
  weekCode: string
}

/**
 * 新增无工作（单周）：校验 PM、无成员已提交周报、与已有记录不重叠
 */
export async function insertPmProjectWeekExemption(
  input: InsertPmProjectWeekExemptionInput
): Promise<void> {
  const { userId, projectId } = input
  const week = input.weekCode.trim()

  if (!week || !parseWeekCode(week)) {
    throw new BusinessError('请选择有效的周次')
  }

  const supabase = await createClient()
  const pmOk = await isUserPmForProject(userId, projectId)
  if (!pmOk) {
    throw new BusinessError('您不是该项目的项目经理，无法设置无工作')
  }

  const newWeeks = weekCodesInclusiveRange(week, week)
  if (!newWeeks.length) {
    throw new BusinessError('周次无效')
  }

  const conflicting = await findProjectWeeksWithExistingReports(
    projectId,
    newWeeks
  )
  if (conflicting.length) {
    const labels = conflicting.map(formatWeekCodeLabelZh).join('、')
    throw new BusinessError(
      `以下周次已有成员提交周报，无法设置无工作：${labels}`
    )
  }

  const newWeekSet = new Set(newWeeks)
  const { data: existing, error: e0 } = await supabase
    .from('project_week_exemptions')
    .select('id, start_week_code, end_week_code')
    .eq('project_id', projectId)

  if (e0) handleDbError(e0)
  for (const ex of existing ?? []) {
    if (
      rangesOverlapWeeks(
        ex.start_week_code,
        ex.end_week_code,
        newWeekSet
      )
    ) {
      throw new BusinessError(
        '所选周次与已有无工作记录重叠，请先删除或调整已有记录'
      )
    }
  }

  const { error } = await supabase.from('project_week_exemptions').insert({
    project_id: projectId,
    start_week_code: week,
    end_week_code: week,
    created_by: userId,
  })

  if (error) handleDbError(error)
}

export async function deletePmProjectWeekExemption(
  userId: string,
  exemptionId: string
): Promise<void> {
  const supabase = await createClient()
  const pmIds = await fetchPmProjectIds(supabase, userId)
  if (!pmIds.length) {
    throw new BusinessError('无权操作')
  }

  const { data: row, error: e0 } = await supabase
    .from('project_week_exemptions')
    .select('id, project_id')
    .eq('id', exemptionId)
    .maybeSingle()

  if (e0) handleDbError(e0)
  if (!row || !pmIds.includes(row.project_id)) {
    throw new BusinessError('记录不存在或无权删除')
  }

  const { error } = await supabase
    .from('project_week_exemptions')
    .delete()
    .eq('id', exemptionId)

  if (error) handleDbError(error)
}

/** 供页面展示：当前用户作为 PM 的项目列表（与周报筛选一致） */
export async function getPmProjectsForExemptions(
  userId: string
): Promise<MemberProjectOption[]> {
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
  return (data ?? []).map((r) =>
    mapProjectRowWithDepartment(r as Record<string, unknown>)
  )
}
