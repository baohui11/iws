import { requireUser, type CurrentUser } from '@/core/auth'
import { canAccessAdminNav } from '@/core/auth/nav-access'
import { AuthError } from '@/core/errors'

/** 要求登录且具备系统管理权限（admin / dept_admin）。 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser()
  if (!canAccessAdminNav(user.role)) {
    throw new AuthError('没有操作权限', 'FORBIDDEN')
  }
  return user
}
