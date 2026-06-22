// lib/db/admin/user.ts
import type { Enums } from '@/types/database'
import { createAdminClient } from '@/lib/supabase/admin'
import { handleDbError } from '@/lib/db/handle-db-error'
import { getDepartmentIdsForListFilter } from '@/lib/db/admin/departments'

export type SystemRole = Enums<'system_roles'>

/**
 * 写入 public.users。
 * `auth_id` 省略或 `null` 表示尚未开通登录；仅在有值时更新 `auth_id`（避免导入覆盖已有绑定）。
 */
export interface InsertUserRow {
  auth_id?: string | null
  email: string
  name: string
  gender: string
  employee_no: string
  department_id: string
  position: string
  role: SystemRole
}

export interface UserRow {
  id: string
  auth_id: string | null
  email: string | null
  name: string | null
  gender: string | null
  employee_no: string | null
  department_id: string | null
  position: string | null
  role: SystemRole | null
  avatar_url: string | null
  created_at: string
  deleted_at: string | null
}

export interface UserWithDepartment extends UserRow {
  department_name: string
}

/** 根据工号 UPSERT：若已存在（含软删除）则恢复并更新，否则新增 */
export async function upsertUserByEmployeeNo(row: InsertUserRow): Promise<string> {
  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('employee_no', row.employee_no)
    .maybeSingle()

  if (existing) {
    const updatePayload: Record<string, unknown> = {
      email: row.email,
      name: row.name,
      gender: row.gender,
      employee_no: row.employee_no,
      department_id: row.department_id,
      position: row.position,
      role: row.role,
      deleted_at: null,
    }
    if (row.auth_id !== undefined) {
      updatePayload.auth_id = row.auth_id
    }
    const { error } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', existing.id)
    if (error) handleDbError(error)
    return existing.id
  }

  const { data, error } = await supabase
    .from('users')
    .insert({
      auth_id: row.auth_id ?? null,
      email: row.email,
      name: row.name,
      gender: row.gender,
      employee_no: row.employee_no,
      department_id: row.department_id,
      position: row.position,
      role: row.role,
    })
    .select('id')
    .single()
  if (error) handleDbError(error)
  return data!.id
}

/** 按工号查找未删除用户 id */
export async function findUserIdByEmployeeNo(employeeNo: string): Promise<string | null> {
  if (!employeeNo?.trim()) return null
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('employee_no', employeeNo.trim())
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()
  if (error) handleDbError(error)
  return data?.id ?? null
}

/** 根据 public.users.id 获取用户（含部门名） */
export async function getUserById(id: string): Promise<UserWithDepartment | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('users')
    .select('*, department_name:departments(name)')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) handleDbError(error)
  if (!data) return null

  return {
    ...(data as UserRow),
    department_name: (data.department_name as unknown as { name: string })?.name ?? '',
  }
}

/** 未绑定 auth、有邮箱、未删除的用户（用于批量邀请） */
export async function listUserIdsPendingAuth(
  limit = 500,
): Promise<{ id: string; email: string }[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, email')
    .is('deleted_at', null)
    .is('auth_id', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) handleDbError(error)
  return (data ?? [])
    .map((r) => ({
      id: r.id as string,
      email: String((r.email as string) ?? '').trim(),
    }))
    .filter((r) => r.email.length > 0)
}

/** 根据 public.users.id 取 auth_id（删除 auth 账号用） */
export async function getAuthIdByUserId(id: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('users')
    .select('auth_id')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) handleDbError(error)
  return data?.auth_id ?? null
}

export interface UserListParams {
  page?: number
  pageSize?: number
  keyword?: string
  department_id?: string
}

export interface UserListResult {
  users: UserWithDepartment[]
  total: number
  page: number
  pageSize: number
}

export async function getUserList(params: UserListParams = {}): Promise<UserListResult> {
  const { page = 1, pageSize = 20, keyword, department_id } = params
  const supabase = createAdminClient()

  let query = supabase
    .from('users')
    .select('*, department_name:departments(name)', { count: 'exact' })
    .is('deleted_at', null)

  if (keyword) {
    query = query.or(`name.ilike.%${keyword}%,employee_no.ilike.%${keyword}%`)
  }
  if (department_id) {
    const deptIds = await getDepartmentIdsForListFilter(department_id)
    query = query.in('department_id', deptIds)
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (error) handleDbError(error)

  const users = (data ?? []).map((row) => ({
    ...(row as UserRow),
    department_name: (row.department_name as unknown as { name: string })?.name ?? '',
  }))

  return { users, total: count ?? 0, page, pageSize }
}

export interface UpdateUserData {
  auth_id?: string | null
  name?: string
  gender?: string
  employee_no?: string
  department_id?: string
  position?: string
  role?: SystemRole
  email?: string
}

export async function updateUserRow(id: string, updates: UpdateUserData) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('users').update(updates).eq('id', id)
  if (error) handleDbError(error)
}

/** 项目等场景：未删除用户（不限部门） */
export async function listUsersForLeaderPick() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email')
    .is('deleted_at', null)
    .order('name')
    .limit(500)

  if (error) handleDbError(error)
  return data ?? []
}

/** 软删除：同时清空 email 和 auth_id，避免重新创建时冲突 */
export async function softDeleteUserById(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('users')
    .update({
      deleted_at: new Date().toISOString(),
      email: null,
      auth_id: null,
    })
    .eq('id', id)
  if (error) handleDbError(error)
}
