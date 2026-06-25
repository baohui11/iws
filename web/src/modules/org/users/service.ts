import { NotFoundError, ValidationError } from '@/core/errors'
import { mapDbError } from '@/core/db/errors'
import { requireAdmin } from '@/modules/org/guard'
import { findDepartmentIdByName } from '@/modules/org/departments/repo'
import {
  getUserById,
  getUserList,
  softDeleteUserById,
  updateUserRow,
  upsertUserByEmployeeNo,
  type UpdateUserData,
  type UserListParams,
} from './repo'
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from './schema'

export async function listUsers(params: UserListParams) {
  await requireAdmin()
  return getUserList(params)
}

export async function getUser(id: string) {
  await requireAdmin()
  const user = await getUserById(id)
  if (!user) throw new NotFoundError('用户不存在')
  return user
}

/**
 * 创建用户：写入用户表（不再走 Supabase 邀请邮件；激活/设密流程见迁移登记 #2）。
 */
export async function createUser(input: CreateUserInput) {
  await requireAdmin()
  const parsed = createUserSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? '参数不合法')
  }
  try {
    const userId = await upsertUserByEmployeeNo({
      email: parsed.data.email,
      name: parsed.data.name,
      gender: parsed.data.gender,
      employee_no: parsed.data.employee_no,
      department_id: parsed.data.department_id,
      position: parsed.data.position,
      role: parsed.data.role ?? 'user',
    })
    return { userId, invited: false }
  } catch (e) {
    mapDbError(e)
  }
}

export async function updateUser(input: UpdateUserInput) {
  await requireAdmin()
  const parsed = updateUserSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? '参数不合法')
  }
  const { id, ...updates } = parsed.data
  if (Object.keys(updates).length === 0) {
    throw new ValidationError('至少需要提供一个更新字段')
  }
  const existing = await getUserById(id)
  if (!existing) throw new NotFoundError('用户不存在')

  try {
    await updateUserRow(id, updates as UpdateUserData)
    return { id }
  } catch (e) {
    mapDbError(e)
  }
}

export async function removeUser(id: string) {
  await requireAdmin()
  if (!id?.trim()) throw new ValidationError('用户 ID 不能为空')
  const existing = await getUserById(id)
  if (!existing) throw new NotFoundError('用户不存在或已删除')
  await softDeleteUserById(id)
  return { id }
}

export interface ImportUserInput {
  employee_no: string
  name: string
  gender: string
  department_id?: string
  department_name?: string
  position: string
  email: string
  role: CreateUserInput['role']
}

export interface ImportResult {
  total: number
  succeeded: number
  failed: number
  results: Array<{
    email: string
    success: boolean
    userId?: string
    message?: string
  }>
}

/** 批量导入：仅写入用户表 */
export async function importUsers(rows: ImportUserInput[]): Promise<ImportResult> {
  await requireAdmin()
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new ValidationError('用户列表不能为空')
  }

  const results: ImportResult['results'] = []
  for (const user of rows) {
    try {
      if (!user.email?.trim()) throw new ValidationError('邮箱不能为空')
      let departmentId = user.department_id?.trim() || ''
      if (!departmentId && user.department_name?.trim()) {
        departmentId = (await findDepartmentIdByName(user.department_name)) ?? ''
      }
      if (!departmentId) {
        throw new ValidationError(
          '部门不能为空（请填写 department_id 或 department_name）'
        )
      }
      const userId = await upsertUserByEmployeeNo({
        email: user.email.trim(),
        name: user.name,
        gender: user.gender,
        employee_no: user.employee_no,
        department_id: departmentId,
        position: user.position,
        role: user.role ?? 'user',
      })
      results.push({ email: user.email, success: true, userId })
    } catch (e) {
      const message = e instanceof Error ? e.message : '创建失败'
      results.push({ email: user.email, success: false, message })
    }
  }

  const succeeded = results.filter((r) => r.success).length
  return {
    total: rows.length,
    succeeded,
    failed: results.length - succeeded,
    results,
  }
}
