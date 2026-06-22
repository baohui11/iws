import { createClient } from '@/lib/supabase/server'
import { handleDbError } from '@/lib/db/handle-db-error'
import { getDepartmentIdsForListFilter } from '@/lib/db/admin/departments'
import { PROJECT_STATUS_VALUES } from '@/constants/project-status'
import { parseProjectRole } from '@/constants/project-roles'
import { mapDbProjectMemberToRow } from '@/lib/mappers/project-members'
import type {
  DeliverableRow,
  ProjectDetail,
  ProjectListItem,
  ProjectRow,
  WeeklyProjectListItem,
} from '@/types/project'
import type { Enums } from '@/types/database'
import type { ProjectRoleValue } from '@/constants/project-roles'

type ServerClient = Awaited<ReturnType<typeof createClient>>

export interface WeeklyMyProjectsParams {
  userId: string
  role: Enums<'system_roles'> | null
  userDepartmentId: string | null
  /** 兼容旧分页；与 offset 二选一，优先 offset */
  page?: number
  pageSize?: number
  /** 从 0 起的偏移，用于无限滚动追加 */
  offset?: number
  /** 编号、名称、客户、合同号（模糊） */
  keyword?: string | null
  /** 按部门（含子部门）筛选 */
  departmentFilterId?: string | null
  /** 仅显示本人为项目成员的项目 */
  onlyParticipating?: boolean
  /** 按项目状态单选筛选（与 DB enum 一致） */
  projectStatusFilter?: string | null
}

export interface WeeklyMyProjectsResult {
  projects: WeeklyProjectListItem[]
  total: number
  page: number
  pageSize: number
}

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

/** 当前用户在这些项目中的成员角色（仅返回有成员记录的行） */
async function fetchMyProjectRoles(
  supabase: ServerClient,
  userId: string,
  projectIds: string[]
): Promise<Map<string, ProjectRoleValue | null>> {
  const map = new Map<string, ProjectRoleValue | null>()
  if (!projectIds.length) return map

  const { data, error } = await supabase
    .from('project_members')
    .select('project_id, project_role')
    .eq('user_id', userId)
    .in('project_id', projectIds)
    .is('deleted_at', null)

  if (error) handleDbError(error)
  for (const r of data ?? []) {
    if (r.project_id) {
      map.set(r.project_id, parseProjectRole(r.project_role))
    }
  }
  return map
}

/** 部门 LD / 部门管理员：本人所在部门及子部门 id */
async function getDeptRoleScopeIds(
  role: Enums<'system_roles'> | null,
  userDepartmentId: string | null
): Promise<string[]> {
  if (
    (role === 'dept_ld' || role === 'dept_admin') &&
    userDepartmentId
  ) {
    return getDepartmentIdsForListFilter(userDepartmentId)
  }
  return []
}

function mapRowToWeeklyItem(
  row: {
    id: string
    project_no: string | null
    project_name: string | null
    customer_name: string | null
    fiscal_year: string | null
    project_status: ProjectListItem['project_status']
    project_stage: string | null
    start_date: string | null
    end_date: string | null
    contract_no: string | null
    department_id: string | null
    department_name: unknown
  },
  memberSet: Set<string>,
  roleByProject: Map<string, ProjectRoleValue | null>
): WeeklyProjectListItem {
  const participating = memberSet.has(row.id)
  return {
    id: row.id,
    project_no: row.project_no,
    project_name: row.project_name,
    customer_name: row.customer_name,
    fiscal_year: row.fiscal_year,
    project_status: row.project_status,
    project_stage: row.project_stage,
    start_date: row.start_date,
    end_date: row.end_date,
    contract_no: row.contract_no,
    department_id: row.department_id,
    department_name:
      (row.department_name as { name: string } | null)?.name ?? null,
    is_participating: participating,
    my_project_role: participating ? roleByProject.get(row.id) ?? null : null,
  }
}

/**
 * 周报侧「我的项目」列表：成员 / 部门 LD 与部门管理员（所在部门及子部门）/ 系统管理员全部。
 * 使用服务端用户会话（RLS：表对 authenticated 可读）。
 */
export async function getMyWeeklyProjectsList(
  params: WeeklyMyProjectsParams
): Promise<WeeklyMyProjectsResult> {
  const {
    userId,
    role,
    userDepartmentId,
    page = 1,
    pageSize: pageSizeRaw = 20,
    offset: offsetParam,
    keyword,
    departmentFilterId,
    onlyParticipating,
    projectStatusFilter,
  } = params

  const pageSize = Math.min(Math.max(1, pageSizeRaw), 100)
  const offset =
    offsetParam != null
      ? Math.max(0, offsetParam)
      : Math.max(0, (page - 1) * pageSize)

  const supabase = await createClient()
  const memberProjectIds = await fetchMemberProjectIds(supabase, userId)
  const memberSet = new Set(memberProjectIds)

  const scopeDeptIds = await getDeptRoleScopeIds(role, userDepartmentId)

  let query = supabase
    .from('projects')
    .select(
      `
      id,
      project_no,
      project_name,
      customer_name,
      fiscal_year,
      project_status,
      project_stage,
      start_date,
      end_date,
      contract_no,
      department_id,
      department_name:departments(name)
    `,
      { count: 'exact' }
    )
    .is('deleted_at', null)

  if (keyword?.trim()) {
    const k = keyword.trim()
    query = query.or(
      `project_no.ilike.%${k}%,project_name.ilike.%${k}%,customer_name.ilike.%${k}%,contract_no.ilike.%${k}%`
    )
  }

  if (projectStatusFilter?.trim()) {
    const s = projectStatusFilter.trim()
    if ((PROJECT_STATUS_VALUES as readonly string[]).includes(s)) {
      query = query.eq('project_status', s)
    }
  }

  if (onlyParticipating) {
    if (!memberProjectIds.length) {
      return {
        projects: [],
        total: 0,
        page: Math.floor(offset / pageSize) + 1,
        pageSize,
      }
    }
    query = query.in('id', memberProjectIds)
  } else if (role !== 'admin') {
    if (!memberProjectIds.length && !scopeDeptIds.length) {
      return {
        projects: [],
        total: 0,
        page: Math.floor(offset / pageSize) + 1,
        pageSize,
      }
    }
    if (memberProjectIds.length && scopeDeptIds.length) {
      query = query.or(
        `id.in.(${memberProjectIds.join(',')}),department_id.in.(${scopeDeptIds.join(',')})`
      )
    } else if (memberProjectIds.length) {
      query = query.in('id', memberProjectIds)
    } else {
      query = query.in('department_id', scopeDeptIds)
    }
  }

  if (departmentFilterId?.trim()) {
    const deptIds = await getDepartmentIdsForListFilter(departmentFilterId.trim())
    query = query.in('department_id', deptIds)
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (error) handleDbError(error)

  const rows = data ?? []
  const projectIds = rows.map((r) => (r as { id: string }).id)
  const roleByProject = await fetchMyProjectRoles(supabase, userId, projectIds)

  const projects: WeeklyProjectListItem[] = rows.map((row) =>
    mapRowToWeeklyItem(
      row as Parameters<typeof mapRowToWeeklyItem>[0],
      memberSet,
      roleByProject
    )
  )

  return {
    projects,
    total: count ?? 0,
    page: Math.floor(offset / pageSize) + 1,
    pageSize,
  }
}

export interface WeeklyProjectAccessContext {
  userId: string
  role: Enums<'system_roles'> | null
  userDepartmentId: string | null
}

/** 当前用户是否可访问该项目（与列表可见性规则一致） */
export async function canAccessWeeklyProject(
  ctx: WeeklyProjectAccessContext,
  projectId: string
): Promise<boolean> {
  const supabase = await createClient()

  if (ctx.role === 'admin') {
    const { data, error } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) handleDbError(error)
    return !!data
  }

  const memberIds = await fetchMemberProjectIds(supabase, ctx.userId)
  if (memberIds.includes(projectId)) return true

  const { data: proj, error: pe } = await supabase
    .from('projects')
    .select('department_id')
    .eq('id', projectId)
    .is('deleted_at', null)
    .maybeSingle()

  if (pe) handleDbError(pe)
  if (!proj?.department_id) return false

  if (
    (ctx.role === 'dept_ld' || ctx.role === 'dept_admin') &&
    ctx.userDepartmentId
  ) {
    const scope = await getDepartmentIdsForListFilter(ctx.userDepartmentId)
    if (scope.includes(proj.department_id)) return true
  }

  return false
}

/** 与 admin getProjectById 同结构，用于周报侧详情（RLS）；含成员与成果清单 */
export async function getWeeklyProjectDetailById(
  projectId: string
): Promise<ProjectDetail | null> {
  const supabase = await createClient()
  const { data: proj, error: pe } = await supabase
    .from('projects')
    .select('*, department_name:departments(name)')
    .eq('id', projectId)
    .is('deleted_at', null)
    .maybeSingle()

  if (pe) handleDbError(pe)
  if (!proj) return null

  const { data: mems, error: me } = await supabase
    .from('project_members')
    .select('id, user_id, project_role, users(name, email)')
    .eq('project_id', projectId)
    .is('deleted_at', null)

  if (me) handleDbError(me)

  const { data: dels, error: de } = await supabase
    .from('contract_deliverables')
    .select('id, name, description')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (de) handleDbError(de)

  const base = proj as ProjectRow & { department_name: unknown }

  const members = (mems ?? []).map((m) =>
    mapDbProjectMemberToRow({
      id: m.id,
      user_id: m.user_id,
      project_role: m.project_role as string | null,
      users: m.users as unknown,
    })
  )

  const deliverables: DeliverableRow[] = (dels ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
  }))

  return {
    ...(base as ProjectRow),
    department_name:
      (base.department_name as unknown as { name: string } | null)?.name ?? null,
    members,
    deliverables,
  } as ProjectDetail
}

export async function getWeeklyProjectSummaryById(
  projectId: string
): Promise<ProjectListItem | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .select(
      `
      id,
      project_no,
      project_name,
      customer_name,
      fiscal_year,
      project_status,
      project_stage,
      start_date,
      end_date,
      contract_no,
      department_id,
      department_name:departments(name)
    `
    )
    .eq('id', projectId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) handleDbError(error)
  if (!data) return null

  const row = data as {
    id: string
    project_no: string | null
    project_name: string | null
    customer_name: string | null
    fiscal_year: string | null
    project_status: ProjectListItem['project_status']
    project_stage: string | null
    start_date: string | null
    end_date: string | null
    contract_no: string | null
    department_id: string | null
    department_name: unknown
  }

  return {
    id: row.id,
    project_no: row.project_no,
    project_name: row.project_name,
    customer_name: row.customer_name,
    fiscal_year: row.fiscal_year,
    project_status: row.project_status,
    project_stage: row.project_stage,
    start_date: row.start_date,
    end_date: row.end_date,
    contract_no: row.contract_no,
    department_id: row.department_id,
    department_name:
      (row.department_name as { name: string } | null)?.name ?? null,
  }
}
