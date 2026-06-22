import { getDepartmentIdsForListFilter } from '@/lib/db/admin/departments'
import type { User } from '@/lib/db/auth/profile'
import { STATS_NAV_ROLES } from '@/lib/auth/nav-access'
import { AuthError, BusinessError, ValidationError } from '@/lib/errors'

export function assertStatsRole(profile: User): void {
  const r = profile.role
  if (!r || !STATS_NAV_ROLES.includes(r as (typeof STATS_NAV_ROLES)[number])) {
    throw new AuthError('无权访问数据统计')
  }
}

/** 校验所选部门在本人可管范围内（admin 不限） */
export async function assertDeptStatsAccess(
  profile: User,
  selectedDepartmentId: string
): Promise<void> {
  assertStatsRole(profile)
  const did = selectedDepartmentId?.trim()
  if (!did) throw new ValidationError('请选择部门')

  if (profile.role === 'admin') return

  if (!profile.department_id) {
    throw new BusinessError('未绑定部门')
  }

  const allowed = await getDepartmentIdsForListFilter(profile.department_id)
  if (!allowed.includes(did)) {
    throw new BusinessError('无权查看该部门数据')
  }
}
