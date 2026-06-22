// lib/db/admin/projects.ts
import { createAdminClient } from '@/lib/supabase/admin'
import { handleDbError } from '@/lib/db/handle-db-error'
import { BusinessError } from '@/lib/errors'
import { getDepartmentIdsForListFilter } from '@/lib/db/admin/departments'
import type { ProjectStatusValue } from '@/constants/project-status'
import type { ProjectRoleValue } from '@/constants/project-roles'
import { mapDbProjectMemberToRow } from '@/lib/mappers/project-members'
import type {
  ProjectRow,
  InsertProjectData,
  UpdateProjectData,
  ProjectListItem,
  ProjectMemberRow,
  DeliverableRow,
  ProjectDetail,
} from '@/types/project'

type AdminClient = ReturnType<typeof createAdminClient>

export type { ProjectRow, InsertProjectData, UpdateProjectData }

export type { ProjectListItem, ProjectMemberRow, DeliverableRow, ProjectDetail }

export interface ProjectListParams {
  page?: number
  pageSize?: number
  keyword?: string
  department_id?: string
}

export interface ProjectListResult {
  projects: ProjectListItem[]
  total: number
  page: number
  pageSize: number
}

export async function getProjectList(params: ProjectListParams = {}): Promise<ProjectListResult> {
  const { page = 1, pageSize = 20, keyword, department_id } = params
  const supabase = createAdminClient()

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
  if (department_id) {
    const deptIds = await getDepartmentIdsForListFilter(department_id)
    query = query.in('department_id', deptIds)
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (error) handleDbError(error)

  const projects: ProjectListItem[] = (data ?? []).map((row) => ({
    id: row.id,
    project_no: row.project_no,
    project_name: row.project_name,
    customer_name: row.customer_name,
    fiscal_year: row.fiscal_year,
    project_status: row.project_status as ProjectListItem['project_status'],
    project_stage: row.project_stage,
    start_date: row.start_date,
    end_date: row.end_date,
    contract_no: row.contract_no,
    department_id: row.department_id,
    department_name:
      (row.department_name as unknown as { name: string } | null)?.name ?? null,
  }))

  return { projects, total: count ?? 0, page, pageSize }
}

export async function getProjectById(id: string): Promise<ProjectDetail | null> {
  const supabase = createAdminClient()
  const { data: proj, error: pe } = await supabase
    .from('projects')
    .select('*, department_name:departments(name)')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (pe) handleDbError(pe)
  if (!proj) return null

  const { data: mems, error: me } = await supabase
    .from('project_members')
    .select('id, user_id, project_role, users(name, email)')
    .eq('project_id', id)
    .is('deleted_at', null)

  if (me) handleDbError(me)

  const { data: dels, error: de } = await supabase
    .from('contract_deliverables')
    .select('id, name, description')
    .eq('project_id', id)
    .order('created_at', { ascending: true })

  if (de) handleDbError(de)

  const base = proj as ProjectRow & {
    department_name: unknown
  }

  const members: ProjectMemberRow[] = (mems ?? []).map((m) =>
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

export async function insertProject(row: InsertProjectData): Promise<string> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('projects').insert(row).select('id').single()
  if (error) handleDbError(error)
  return data!.id
}

export async function updateProjectRow(id: string, updates: UpdateProjectData) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('projects').update(updates).eq('id', id)
  if (error) handleDbError(error)
}

export async function softDeleteProject(id: string) {
  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const { error: e1 } = await supabase
    .from('projects')
    .update({ deleted_at: now })
    .eq('id', id)
  if (e1) handleDbError(e1)

  const { error: e2 } = await supabase
    .from('project_members')
    .update({ deleted_at: now })
    .eq('project_id', id)
    .is('deleted_at', null)
  if (e2) handleDbError(e2)

  const { error: e3 } = await supabase.from('contract_deliverables').delete().eq('project_id', id)
  if (e3) handleDbError(e3)
}

export interface MemberInput {
  user_id: string
  project_role: ProjectRoleValue
}

export interface DeliverableInput {
  /** 已有行传数据库 id；新增行不传 */
  id?: string
  name: string
  description?: string | null
}

async function softDeleteAllMembers(supabase: AdminClient, projectId: string) {
  const { error } = await supabase
    .from('project_members')
    .update({ deleted_at: new Date().toISOString() })
    .eq('project_id', projectId)
    .is('deleted_at', null)
  if (error) handleDbError(error)
}

export async function replaceProjectMembers(projectId: string, members: MemberInput[]) {
  const supabase = createAdminClient()
  await softDeleteAllMembers(supabase, projectId)

  const rows = members
    .filter((m) => m.user_id?.trim())
    .map((m) => ({
      project_id: projectId,
      user_id: m.user_id.trim(),
      project_role: m.project_role,
    }))

  if (rows.length === 0) return

  const { error } = await supabase.from('project_members').insert(rows)
  if (error) handleDbError(error)
}

/**
 * 成果清单增删改：按 id 更新已有行、插入新行、对表单中已移除的行做物理删除。
 */
export async function syncContractDeliverables(
  projectId: string,
  items: DeliverableInput[]
) {
  const supabase = createAdminClient()
  const normalized = items
    .filter((d) => d.name?.trim())
    .map((d) => ({
      id: d.id?.trim() || undefined,
      name: d.name.trim(),
      description: d.description?.trim() || null,
    }))

  const { data: existingRows, error: e0 } = await supabase
    .from('contract_deliverables')
    .select('id')
    .eq('project_id', projectId)

  if (e0) handleDbError(e0)

  const existingIds = new Set((existingRows ?? []).map((r) => r.id))
  const keptIds = new Set<string>()

  for (const row of normalized) {
    if (row.id) {
      if (!existingIds.has(row.id)) {
        throw new BusinessError('合同成果项不存在或已删除')
      }
      const { error } = await supabase
        .from('contract_deliverables')
        .update({ name: row.name, description: row.description })
        .eq('id', row.id)
        .eq('project_id', projectId)
      if (error) handleDbError(error)
      keptIds.add(row.id)
    } else {
      const { error } = await supabase.from('contract_deliverables').insert({
        project_id: projectId,
        name: row.name,
        description: row.description,
      })
      if (error) handleDbError(error)
    }
  }

  for (const id of existingIds) {
    if (!keptIds.has(id)) {
      const { error } = await supabase
        .from('contract_deliverables')
        .delete()
        .eq('id', id)
        .eq('project_id', projectId)
      if (error) handleDbError(error)
    }
  }
}

/**
 * 同一项目下同一用户仅一条有效成员：已存在则更新角色，否则插入。
 */
export async function upsertProjectMember(
  projectId: string,
  userId: string,
  project_role: ProjectRoleValue
) {
  const supabase = createAdminClient()
  const { data: existing, error: e0 } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (e0) handleDbError(e0)

  if (existing) {
    const { error } = await supabase
      .from('project_members')
      .update({ project_role })
      .eq('id', existing.id)
    if (error) handleDbError(error)
    return
  }

  const { error } = await supabase.from('project_members').insert({
    project_id: projectId,
    user_id: userId,
    project_role,
  })
  if (error) handleDbError(error)
}

export async function insertContractDeliverable(
  projectId: string,
  name: string,
  description: string | null
) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('contract_deliverables').insert({
    project_id: projectId,
    name: name.trim(),
    description: description?.trim() ? description.trim() : null,
  })
  if (error) handleDbError(error)
}

export async function findActiveProjectIdByProjectNo(
  projectNo: string
): Promise<string | null> {
  if (!projectNo?.trim()) return null
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .eq('project_no', projectNo.trim())
    .is('deleted_at', null)
    .maybeSingle()

  if (error) handleDbError(error)
  return data?.id ?? null
}

export async function getProjectStageById(
  projectId: string,
): Promise<string | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('projects')
    .select('project_stage')
    .eq('id', projectId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) handleDbError(error)
  return data?.project_stage ?? null
}

export interface ProjectImportRow {
  project_no: string
  project_name?: string | null
  customer_name?: string | null
  department_id?: string | null
  fiscal_year?: string | null
  project_status?: ProjectStatusValue | null
  project_stage?: string | null
  start_date?: string | null
  end_date?: string | null
  contract_no?: string | null
  business_type?: string | null
  industry_category?: string | null
  product_block?: string | null
  project_introduction?: string | null
}

function buildProjectInsertFromImport(row: ProjectImportRow): InsertProjectData {
  return {
    project_no: row.project_no.trim(),
    project_name: row.project_name?.trim() || null,
    customer_name: row.customer_name?.trim() || null,
    department_id: row.department_id?.trim() || null,
    fiscal_year: row.fiscal_year?.trim() || null,
    project_status: row.project_status ?? null,
    project_stage: row.project_stage?.trim() || null,
    start_date: row.start_date?.trim() || null,
    end_date: row.end_date?.trim() || null,
    contract_no: row.contract_no?.trim() || null,
    business_type: row.business_type?.trim() || null,
    industry_category: row.industry_category?.trim() || null,
    product_block: row.product_block?.trim() || null,
    project_introduction: row.project_introduction?.trim() || null,
  }
}

/** CSV 导入：按项目编号 upsert（仅项目主表，不含成员与成果） */
export async function upsertProjectFromImport(row: ProjectImportRow): Promise<string> {
  const payload = buildProjectInsertFromImport(row)
  const existingId = await findActiveProjectIdByProjectNo(row.project_no)
  if (existingId) {
    const { project_no: _n, ...updates } = payload
    await updateProjectRow(existingId, updates as UpdateProjectData)
    return existingId
  }
  return insertProject(payload)
}
