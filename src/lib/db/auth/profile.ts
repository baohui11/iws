import type { Enums } from '@/types/database'
import { createClient } from '@/lib/supabase/server'
import { handleDbError } from '@/lib/db/handle-db-error'
import { NotFoundError } from '@/lib/errors'

export interface User {
  id: string
  auth_id: string | null
  email: string
  name: string
  gender: string | null
  employee_no: string | null
  department_id: string | null
  /** 关联 departments 当前行的 name（叶子部门名）；个人设置页会用 formatDepartmentPathLabel 覆盖为「一级 / 二级」展示 */
  department_name?: string
  position: string | null
  role: Enums<'system_roles'> | null
  /** `avatars` bucket 内对象路径，如 `userId/uuid.jpg` */
  avatar_url: string | null
}

/** 当前登录会话：用 auth.uid() 查 public.users（auth_id），含部门名称 */
export async function getProfileById(authUserId: string): Promise<User | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('users')
    .select('*, department_name:departments(name)')
    .eq('auth_id', authUserId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) handleDbError(error)

  if (!data) return null

  const departmentName =
    (data.department_name as unknown as { name: string } | null)?.name ?? ''

  return {
    id: data.id,
    auth_id: data.auth_id,
    email: data.email ?? '',
    name: data.name ?? '',
    gender: data.gender,
    employee_no: data.employee_no,
    department_id: data.department_id,
    department_name: departmentName,
    position: data.position,
    role: data.role,
    avatar_url: data.avatar_url,
  }
}

/**
 * 服务端页面用：路由由中间件保护登录，此处仅解析会话并取 public.users。
 * createClient 仅在此模块内使用，页面组件不必引用 @/lib/supabase/server。
 */
export async function getSessionProfile(): Promise<User> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new NotFoundError('用户资料不存在')
  }
  const profile = await getProfileById(user.id)
  if (!profile) {
    throw new NotFoundError('用户资料不存在')
  }
  return profile
}

export async function updateAvatarUrlByAuthId(
  authUserId: string,
  /** `avatars` bucket 内对象路径 */
  avatarUrl: string,
): Promise<void> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('users')
    .update({ avatar_url: avatarUrl })
    .eq('auth_id', authUserId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) handleDbError(error)
  if (!data) throw new NotFoundError('用户资料不存在')
}
