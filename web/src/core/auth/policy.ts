/**
 * 集中式鉴权策略（骨架）。
 *
 * 目标：把散落在各 action 里的内联判断（report.user_id === me、isProjectMember、
 * projectHasPm 等）收口到统一的 `can()` / `assert()`，逐条对齐原 RLS 语义。
 *
 * 阶段 1 仅定义骨架与系统角色级判断；项目级（需查成员关系）的策略在
 * 各域重构（阶段 2）时按需补充对应的 resource 与判定函数。
 */
import type { CurrentUser, SystemRole } from './current-user'
import { AuthError } from '@/core/errors'

export type { SystemRole }

const ROLE_RANK: Record<SystemRole, number> = {
  user: 0,
  dept_ld: 1,
  dept_admin: 2,
  admin: 3,
}

export function hasRoleAtLeast(user: CurrentUser, role: SystemRole): boolean {
  const have = user.role ? ROLE_RANK[user.role] : -1
  return have >= ROLE_RANK[role]
}

export function isAdmin(user: CurrentUser): boolean {
  return user.role === 'admin'
}

/** 断言系统角色达到要求，否则抛 FORBIDDEN。 */
export function assertRoleAtLeast(user: CurrentUser, role: SystemRole): void {
  if (!hasRoleAtLeast(user, role)) {
    throw new AuthError('没有操作权限', 'FORBIDDEN')
  }
}
