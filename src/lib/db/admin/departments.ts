// lib/db/admin/departments.ts
import { createAdminClient } from '@/lib/supabase/admin'
import { handleDbError } from '@/lib/db/handle-db-error'

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * 根据部门名称查询部门ID（精确匹配 name，0 条则 null，多条取第一条）
 */
export async function findDepartmentIdByName(departmentName: string): Promise<string | null> {
  if (!departmentName?.trim()) {
    return null
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('departments')
    .select('id')
    .eq('name', departmentName.trim())
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()

  if (error) handleDbError(error)
  return data?.id ?? null
}

/**
 * 列表按部门筛选时：选一级（根）部门 → 包含该部门及所有下级部门；选子部门 → 仅匹配该部门。
 */
export async function getDepartmentIdsForListFilter(departmentId: string): Promise<string[]> {
  const supabase = createAdminClient()
  const { data: rows, error } = await supabase
    .from('departments')
    .select('id, parent_id')
    .is('deleted_at', null)
  if (error) handleDbError(error)

  const list = rows ?? []
  const self = list.find((r) => r.id === departmentId)
  if (!self) return [departmentId]

  if (self.parent_id != null) {
    return [self.id]
  }

  const childrenByParent = new Map<string, string[]>()
  for (const r of list) {
    if (r.parent_id) {
      const arr = childrenByParent.get(r.parent_id) ?? []
      arr.push(r.id)
      childrenByParent.set(r.parent_id, arr)
    }
  }

  const ids: string[] = [self.id]
  const stack = [...(childrenByParent.get(self.id) ?? [])]
  while (stack.length) {
    const id = stack.pop()!
    ids.push(id)
    const kids = childrenByParent.get(id)
    if (kids) stack.push(...kids)
  }
  return ids
}

export interface DepartmentNode {
  id: string
  name: string
  parent_id: string | null
  code: string
  level: number | null
  children?: DepartmentNode[]
}

/**
 * 查询两级部门树：根部门 + 子部门（parent_id 指向根）
 */
export async function getDepartmentTree(): Promise<DepartmentNode[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('departments')
    .select('id, name, parent_id, code, level')
    .is('deleted_at', null)
    .order('code', { ascending: true })

  if (error) {
    handleDbError(error)
  }

  const list = (data ?? []) as DepartmentNode[]

  const roots = list.filter((d) => d.parent_id == null)
  const childrenByParent = new Map<string, DepartmentNode[]>()

  for (const d of list) {
    if (d.parent_id == null) continue
    const row: DepartmentNode = { ...d, children: undefined }
    const bucket = childrenByParent.get(d.parent_id) ?? []
    bucket.push(row)
    childrenByParent.set(d.parent_id, bucket)
  }

  return roots.map((r) => ({
    ...r,
    children: childrenByParent.get(r.id) ?? [],
  }))
}

/** 仅根部门，用于「上级部门」下拉（两级结构） */
export async function getRootDepartments() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('departments')
    .select('id, name, code')
    .is('deleted_at', null)
    .is('parent_id', null)
    .order('code', { ascending: true })

  if (error) handleDbError(error)
  return data ?? []
}

export interface DepartmentAdminRow {
  id: string
  code: string
  name: string
  parent_id: string | null
  level: number | null
  created_at: string
  deleted_at: string | null
}

export interface DepartmentWithRelations extends DepartmentAdminRow {
  parent_name: string | null
  /** 本部门内系统角色为 dept_ld 的用户（姓名，多个用顿号分隔） */
  leader_name: string | null
  leader_email: string | null
}

export interface DepartmentListParams {
  page?: number
  pageSize?: number
  keyword?: string
}

export interface DepartmentListResult {
  departments: DepartmentWithRelations[]
  total: number
  page: number
  pageSize: number
}

async function attachDepartmentRelations(
  supabase: AdminClient,
  rows: DepartmentAdminRow[],
): Promise<DepartmentWithRelations[]> {
  const parentIds = [...new Set(rows.map((r) => r.parent_id).filter(Boolean))] as string[]
  const deptIds = rows.map((r) => r.id)

  const parentMap = new Map<string, string>()
  if (parentIds.length > 0) {
    const { data: ps, error: pe } = await supabase
      .from('departments')
      .select('id,name')
      .in('id', parentIds)
    if (pe) handleDbError(pe)
    ps?.forEach((p) => parentMap.set(p.id, p.name))
  }

  const ldsByDept = new Map<string, { name: string; email: string | null }[]>()
  if (deptIds.length > 0) {
    const { data: ldUsers, error: ldErr } = await supabase
      .from('users')
      .select('id, name, email, department_id')
      .in('department_id', deptIds)
      .eq('role', 'dept_ld')
      .is('deleted_at', null)
      .order('name')
    if (ldErr) handleDbError(ldErr)
    for (const u of ldUsers ?? []) {
      const did = u.department_id as string | null
      if (!did) continue
      const arr = ldsByDept.get(did) ?? []
      arr.push({
        name: (u.name ?? '').trim() || '未命名',
        email: u.email,
      })
      ldsByDept.set(did, arr)
    }
  }

  return rows.map((row) => {
    const list = ldsByDept.get(row.id) ?? []
    const names = list.map((x) => x.name).filter(Boolean)
    const leader_name = names.length ? names.join('、') : null
    const leader_email = list.length === 1 ? list[0].email ?? null : null

    return {
      ...row,
      parent_name: row.parent_id ? parentMap.get(row.parent_id) ?? null : null,
      leader_name,
      leader_email,
    }
  })
}

export async function getDepartmentList(
  params: DepartmentListParams = {},
): Promise<DepartmentListResult> {
  const { page = 1, pageSize = 20, keyword } = params
  const supabase = createAdminClient()

  let query = supabase.from('departments').select('*', { count: 'exact' }).is('deleted_at', null)

  if (keyword?.trim()) {
    query = query.or(`name.ilike.%${keyword}%,code.ilike.%${keyword}%`)
  }

  const { data, error, count } = await query
    .order('code', { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (error) handleDbError(error)

  const rows = (data ?? []) as DepartmentAdminRow[]
  const departments = await attachDepartmentRelations(supabase, rows)

  return { departments, total: count ?? 0, page, pageSize }
}

export async function getDepartmentById(id: string): Promise<DepartmentWithRelations | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) handleDbError(error)
  if (!data) return null

  const [withRel] = await attachDepartmentRelations(supabase, [data as DepartmentAdminRow])
  return withRel
}

export interface InsertDepartmentData {
  code: string
  name: string
  parent_id: string | null
  level: number | null
}

export async function insertDepartment(row: InsertDepartmentData): Promise<string> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('departments').insert(row).select('id').single()
  if (error) handleDbError(error)
  return data!.id
}

export interface UpdateDepartmentData {
  code?: string
  name?: string
  parent_id?: string | null
  level?: number | null
}

export async function updateDepartment(id: string, updates: UpdateDepartmentData) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('departments').update(updates).eq('id', id)
  if (error) handleDbError(error)
}

export async function softDeleteDepartment(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('departments')
    .update({
      deleted_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) handleDbError(error)
}

/** 子部门数量（未删除） */
export async function countChildDepartments(parentId: string): Promise<number> {
  const supabase = createAdminClient()
  const { count, error } = await supabase
    .from('departments')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', parentId)
    .is('deleted_at', null)

  if (error) handleDbError(error)
  return count ?? 0
}
