import { NotFoundError, ValidationError } from '@/core/errors'
import { requireAdmin } from '@/modules/org/guard'
import { parseSystemRole, type SystemRoleValue } from '@/constants/system-roles'
import { getAdminDepartmentScopeIds } from '@/modules/org/departments/repo'
import {
  getUserById,
  getUserList,
  listAllUserDataScopes,
  replaceUserDataScopes,
  searchUsersForDataScopePick,
  updateUserRow,
  type UserDataScopeInput,
  type UserListParams,
  type UserWithDepartment,
} from './repo'

export async function listUsers(params: UserListParams) {
  const user = await requireAdmin()
  const allowedDepartmentIds = await getAdminDepartmentScopeIds(user, {
    includeInactive: true,
  })
  return getUserList({ ...params, allowed_department_ids: allowedDepartmentIds })
}

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function usersToCsv(users: UserWithDepartment[]): string {
  const header = ['工号', '姓名', '部门', '角色', '标签', '状态', '邮箱', '职位']
  const rows = users.map((user) => [
    user.employee_no,
    user.name,
    user.department_name,
    user.role,
    user.tags,
    user.is_active ? '已生效' : '未生效',
    user.email,
    user.position,
  ])
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
}

export async function exportUsersCsv(params: UserListParams) {
  const user = await requireAdmin()
  const allowedDepartmentIds = await getAdminDepartmentScopeIds(user, {
    includeInactive: true,
  })
  const result = await getUserList({
    ...params,
    page: 1,
    pageSize: 10000,
    allowed_department_ids: allowedDepartmentIds,
  })
  return {
    filename: `users-${new Date().toISOString().slice(0, 10)}.csv`,
    csv: `\uFEFF${usersToCsv(result.users)}`,
  }
}

export async function getUserForAdmin(id: string) {
  const actor = await requireAdmin()
  const user = await getUserById(id)
  if (!user) throw new NotFoundError('用户不存在')
  const allowedDepartmentIds = await getAdminDepartmentScopeIds(actor, {
    includeInactive: true,
  })
  if (
    allowedDepartmentIds &&
    (!user.department_id || !allowedDepartmentIds.includes(user.department_id))
  ) {
    throw new NotFoundError('用户不存在')
  }
  return user
}

export async function updateUserActive(input: { id: string; is_active: boolean }) {
  await requireAdmin()
  if (!input.id?.trim()) throw new ValidationError('用户 ID 不能为空')
  if (typeof input.is_active !== 'boolean') {
    throw new ValidationError('生效状态不合法')
  }
  const existing = await getUserForAdmin(input.id)
  if (!existing) throw new NotFoundError('用户不存在')
  await updateUserRow(input.id, { is_active: input.is_active })
  return { id: input.id, is_active: input.is_active }
}

export async function updateUserRole(input: { id: string; role: SystemRoleValue }) {
  await requireAdmin()
  if (!input.id?.trim()) throw new ValidationError('用户 ID 不能为空')
  const role = parseSystemRole(input.role)
  if (!role) throw new ValidationError('角色不合法')
  const existing = await getUserForAdmin(input.id)
  if (!existing) throw new NotFoundError('用户不存在')
  await updateUserRow(input.id, { role })
  return { id: input.id, role }
}

export async function updateUserTags(input: { id: string; tags: string | null }) {
  await requireAdmin()
  if (!input.id?.trim()) throw new ValidationError('用户 ID 不能为空')
  const tags = input.tags?.trim() || null
  const existing = await getUserForAdmin(input.id)
  if (!existing) throw new NotFoundError('用户不存在')
  await updateUserRow(input.id, { tags })
  return { id: input.id, tags }
}

export async function updateUserAdminSettings(input: {
  id: string
  role: SystemRoleValue
  tags: string | null
  is_active: boolean
}) {
  await requireAdmin()
  if (!input.id?.trim()) throw new ValidationError('用户 ID 不能为空')
  const role = parseSystemRole(input.role)
  if (!role) throw new ValidationError('角色不合法')
  if (typeof input.is_active !== 'boolean') {
    throw new ValidationError('生效状态不合法')
  }
  const existing = await getUserForAdmin(input.id)
  if (!existing) throw new NotFoundError('用户不存在')
  const tags = input.tags?.trim() || null
  await updateUserRow(input.id, {
    role,
    tags,
    is_active: input.is_active,
  })
  return { id: input.id, role, tags, is_active: input.is_active }
}

export async function listDataScopes() {
  const user = await requireAdmin()
  if (user.role !== 'admin') {
    throw new ValidationError('只有系统管理员可以查看数据权限')
  }
  return listAllUserDataScopes()
}

export async function searchDataScopeUsers(input: {
  keyword?: string
  limit?: number
}) {
  const user = await requireAdmin()
  if (user.role !== 'admin') {
    throw new ValidationError('只有系统管理员可以维护数据权限')
  }
  return searchUsersForDataScopePick({
    keyword: input.keyword,
    limit: input.limit,
  })
}

export async function saveDataScopes(input: {
  user_id: string
  data_scopes: UserDataScopeInput[]
}) {
  const user = await requireAdmin()
  if (user.role !== 'admin') {
    throw new ValidationError('只有系统管理员可以维护数据权限')
  }
  if (!input.user_id?.trim()) throw new ValidationError('请选择用户')
  await replaceUserDataScopes(input.user_id.trim(), input.data_scopes ?? [])
  return { user_id: input.user_id.trim() }
}
