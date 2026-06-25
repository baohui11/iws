import type { CurrentUser } from '@/core/auth/current-user'
import { STATS_NAV_ROLES } from '@/core/auth/nav-access'
import { AuthError, BusinessError, ValidationError } from '@/core/errors'
import { getDepartmentIdsForListFilter } from '@/modules/org/departments/repo'

export function assertStatsRole(user: CurrentUser): void {
  const r = user.role
  if (!r || !STATS_NAV_ROLES.includes(r as (typeof STATS_NAV_ROLES)[number])) {
    throw new AuthError('无权访问数据统计')
  }
}

/** 校验所选部门在本人可管范围内（admin 不限） */
export async function assertDeptStatsAccess(
  user: CurrentUser,
  selectedDepartmentId: string
): Promise<void> {
  assertStatsRole(user)
  const did = selectedDepartmentId?.trim()
  if (!did) throw new ValidationError('请选择部门')

  if (user.role === 'admin') return

  if (!user.departmentId) {
    throw new BusinessError('未绑定部门')
  }

  const allowed = await getDepartmentIdsForListFilter(user.departmentId)
  if (!allowed.includes(did)) {
    throw new BusinessError('无权查看该部门数据')
  }
}
