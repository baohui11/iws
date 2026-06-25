/**
 * 当前登录用户上下文（服务端）。
 * 会话来自 jose 签名的 httpOnly cookie；用户资料从自建库读取。
 */
import { and, eq, isNull } from 'drizzle-orm'
import { getDb } from '@/core/db/client'
import { departments, users } from '@/core/db/schema'
import { AuthError } from '@/core/errors'
import { getSessionUserId } from './session'

export type SystemRole = 'user' | 'dept_ld' | 'dept_admin' | 'admin'

/** 当前登录用户（对应 public.users 关键字段，命名采用 camelCase） */
export interface CurrentUser {
  id: string
  email: string
  name: string
  gender: string | null
  employeeNo: string | null
  departmentId: string | null
  /** 部门名称（叶子部门名） */
  departmentName: string | null
  position: string | null
  role: SystemRole | null
  /** 头像在对象存储中的对象路径 */
  avatarUrl: string | null
}

/** 返回当前登录用户资料；未登录返回 null。 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const userId = await getSessionUserId()
  if (!userId) return null

  const db = getDb()
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      gender: users.gender,
      employeeNo: users.employeeNo,
      departmentId: users.departmentId,
      departmentName: departments.name,
      position: users.position,
      role: users.role,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  return {
    id: row.id,
    email: row.email ?? '',
    name: row.name ?? '',
    gender: row.gender,
    employeeNo: row.employeeNo,
    departmentId: row.departmentId,
    departmentName: row.departmentName ?? null,
    position: row.position,
    role: row.role,
    avatarUrl: row.avatarUrl,
  }
}

/** 要求已登录，否则抛 AuthError。 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) throw new AuthError('请先登录')
  return user
}
