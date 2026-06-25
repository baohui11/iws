import type { SystemRole } from './current-user'

/** 数据统计入口与 /stats 路由 */
export const STATS_NAV_ROLES = ['admin', 'dept_ld', 'dept_admin'] as const

/** 系统管理入口与 /admin 路由 */
export const ADMIN_NAV_ROLES = ['admin', 'dept_admin'] as const

export function canAccessStatsNav(role: SystemRole | null | undefined): boolean {
  if (!role) return false
  return (STATS_NAV_ROLES as readonly string[]).includes(role)
}

export function canAccessAdminNav(role: SystemRole | null | undefined): boolean {
  if (!role) return false
  return (ADMIN_NAV_ROLES as readonly string[]).includes(role)
}
