// actions/admin/users.action.ts
'use server'

import { handleAction } from '@/lib/action-handler'
import { BusinessError, ValidationError, NotFoundError } from '@/lib/errors'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  upsertUserByEmployeeNo,
  getUserById,
  getUserList,
  getAuthIdByUserId,
  updateUserRow,
  softDeleteUserById,
  listUserIdsPendingAuth,
  type UserListParams,
  type UpdateUserData,
} from '@/lib/db/admin/user'
import { findDepartmentIdByName } from '@/lib/db/admin/departments'
import type { SystemRoleValue } from '@/constants/system-roles'

async function inviteUserCore(userId: string) {
  if (!userId?.trim()) throw new ValidationError('用户 ID 不能为空')

  const row = await getUserById(userId)
  if (!row) throw new NotFoundError('用户不存在')
  if (row.auth_id) {
    throw new BusinessError('该用户已开通登录，无需再次邀请')
  }
  const email = (row.email ?? '').trim()
  if (!email) {
    throw new BusinessError('请先填写邮箱后再发送邀请')
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: {
      role: row.role ?? 'user',
      department_id: row.department_id,
    },
  })
  if (error || !data.user?.id) {
    throw new BusinessError(error?.message ?? '发送邀请失败')
  }

  await updateUserRow(userId, { auth_id: data.user.id })
  return { userId, authId: data.user.id }
}

/* ─── 查询类 Action ─── */

export async function getUser(id: string) {
  return handleAction(async () => {
    const user = await getUserById(id)
    if (!user) throw new NotFoundError('用户不存在')
    return user
  })
}

export async function listUsers(params: UserListParams) {
  return handleAction(async () => {
    return await getUserList(params)
  })
}

/* ─── 写入类 Action ─── */

interface CreateUserInput {
  employee_no: string
  name: string
  gender: string
  department_id: string
  position: string
  email: string
  role?: SystemRoleValue
  /** 默认 true：写入 public.users 后发送邀请邮件并创建 auth 用户 */
  sendInvite?: boolean
}

/**
 * 创建用户：先写入 public.users，再按需调用 Supabase Auth 发送邀请并回写 auth_id。
 */
export async function createUser(input: CreateUserInput) {
  return handleAction(async () => {
    const requiredFields = [
      { key: 'email', label: '邮箱', value: input.email },
      { key: 'name', label: '姓名', value: input.name },
      { key: 'gender', label: '性别', value: input.gender },
      { key: 'department_id', label: '部门', value: input.department_id },
      { key: 'position', label: '职位', value: input.position },
      { key: 'employee_no', label: '工号', value: input.employee_no },
    ]
    const emptyFields = requiredFields
      .filter((item) => !item.value?.trim())
      .map((item) => item.label)
    if (emptyFields.length > 0) {
      throw new ValidationError(`必填项不能为空：${emptyFields.join('、')}`)
    }

    const role = input.role ?? 'user'
    const sendInvite = input.sendInvite !== false

    const userId = await upsertUserByEmployeeNo({
      auth_id: null,
      email: input.email.trim(),
      name: input.name,
      gender: input.gender,
      employee_no: input.employee_no,
      department_id: input.department_id,
      position: input.position,
      role,
    })

    if (!sendInvite) {
      return { userId, authId: null as string | null, email: input.email.trim(), invited: false }
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(input.email.trim(), {
      data: {
        role,
        department_id: input.department_id,
      },
    })
    if (error || !data.user?.id) {
      throw new BusinessError(error?.message ?? '创建登录账号失败')
    }

    await updateUserRow(userId, { auth_id: data.user.id })

    return {
      userId,
      authId: data.user.id,
      email: data.user.email ?? input.email.trim(),
      invited: true,
    }
  })
}

interface UpdateUserInput extends UpdateUserData {
  id: string
}

export async function updateUser(input: UpdateUserInput) {
  return handleAction(async () => {
    const { id, ...updates } = input

    if (!id?.trim()) throw new ValidationError('用户 ID 不能为空')
    if (Object.keys(updates).length === 0) {
      throw new ValidationError('至少需要提供一个更新字段')
    }

    const existing = await getUserById(id)
    if (!existing) throw new NotFoundError('用户不存在')

    const supabase = createAdminClient()
    if (updates.email !== undefined) {
      const nextEmail = updates.email.trim()
      const prevEmail = (existing.email ?? '').trim()
      if (nextEmail !== prevEmail) {
        if (existing.auth_id) {
          const { error } = await supabase.auth.admin.updateUserById(existing.auth_id, {
            email: nextEmail,
          })
          if (error) throw new BusinessError(error.message)
        }
        updates.email = nextEmail
      }
    }

    await updateUserRow(id, updates)
    return { id }
  })
}

/** 发送邀请（仅适用于尚未绑定 auth 的 public.users） */
export async function inviteUserById(userId: string) {
  return handleAction(async () => inviteUserCore(userId))
}

export interface InvitePendingResult {
  total: number
  succeeded: number
  failed: number
  results: Array<{ id: string; email: string; success: boolean; message?: string }>
}

/** 批量邀请当前所有「未绑定 auth」且「有邮箱」的用户 */
export async function inviteAllPendingUsers() {
  return handleAction(async () => {
    const pending = await listUserIdsPendingAuth(500)
    const results: InvitePendingResult['results'] = []

    for (const { id, email } of pending) {
      try {
        await inviteUserCore(id)
        results.push({ id, email, success: true })
      } catch (e) {
        const message = e instanceof Error ? e.message : '邀请失败'
        results.push({ id, email, success: false, message })
      }
    }

    const succeeded = results.filter((x) => x.success).length
    const failed = results.length - succeeded
    return { total: pending.length, succeeded, failed, results } satisfies InvitePendingResult
  })
}

/** 删除：若已绑定 auth 则一并删除；否则仅软删除 public.users */
export async function removeUser(id: string) {
  return handleAction(async () => {
    if (!id?.trim()) throw new ValidationError('用户 ID 不能为空')

    const authId = await getAuthIdByUserId(id)
    if (!authId) {
      const row = await getUserById(id)
      if (!row) throw new NotFoundError('用户不存在或已删除')
      await softDeleteUserById(id)
      return { id }
    }

    const supabase = createAdminClient()
    const { error } = await supabase.auth.admin.deleteUser(authId)
    if (error) throw new BusinessError(error.message)

    await softDeleteUserById(id)
    return { id }
  })
}

interface ImportUserInput {
  employee_no: string
  name: string
  gender: string
  department_id?: string
  department_name?: string
  position: string
  email: string
  role: SystemRoleValue
}

interface ImportResult {
  total: number
  succeeded: number
  failed: number
  results: Array<{ email: string; success: boolean; userId?: string; message?: string }>
}

/** 批量导入：仅写入 public.users，不创建 auth、不发送邀请 */
export async function importUsers(users: ImportUserInput[]) {
  return handleAction(async () => {
    if (!Array.isArray(users) || users.length === 0) {
      throw new ValidationError('用户列表不能为空')
    }

    const results: ImportResult['results'] = []

    for (const user of users) {
      try {
        if (!user.email?.trim()) {
          throw new ValidationError('邮箱不能为空')
        }

        let departmentId = user.department_id?.trim() || ''
        if (!departmentId && user.department_name?.trim()) {
          departmentId = (await findDepartmentIdByName(user.department_name)) ?? ''
        }
        if (!departmentId) {
          throw new ValidationError('部门不能为空（请填写 department_id 或 department_name）')
        }

        const role = user.role
        const userId = await upsertUserByEmployeeNo({
          auth_id: null,
          email: user.email.trim(),
          name: user.name,
          gender: user.gender,
          employee_no: user.employee_no,
          department_id: departmentId,
          position: user.position,
          role,
        })

        results.push({ email: user.email, success: true, userId })
      } catch (e) {
        const message = e instanceof Error ? e.message : '创建失败'
        results.push({ email: user.email, success: false, message })
      }
    }

    const succeeded = results.filter((r) => r.success).length
    const failed = results.length - succeeded

    return { total: users.length, succeeded, failed, results } as ImportResult
  })
}
