/**
 * 与数据库 enum system_roles 一致。客户端从此处引用。
 */
export const SYSTEM_ROLE_VALUES = ['user', 'dept_ld', 'dept_admin', 'admin'] as const

export type SystemRoleValue = (typeof SYSTEM_ROLE_VALUES)[number]

export const SYSTEM_ROLE_LABEL: Record<SystemRoleValue, string> = {
  user: '普通用户',
  dept_ld: '部门LD',
  dept_admin: '部门管理员',
  admin: '系统管理员',
}

export const SYSTEM_ROLE_OPTIONS: { key: SystemRoleValue; label: string }[] =
  SYSTEM_ROLE_VALUES.map((key) => ({ key, label: SYSTEM_ROLE_LABEL[key] }))

export function parseSystemRole(
  value: string | null | undefined
): SystemRoleValue | null {
  if (value == null || value === '') return null
  const t = value.trim()
  return SYSTEM_ROLE_VALUES.includes(t as SystemRoleValue)
    ? (t as SystemRoleValue)
    : null
}

export function defaultSystemRole(
  value: string | null | undefined
): SystemRoleValue {
  return parseSystemRole(value) ?? 'user'
}

/** CSV/导入：英文枚举值或中文标签 */
export function parseSystemRoleFromImport(raw: string): SystemRoleValue | null {
  const t = raw.trim()
  if (!t) return null
  const direct = parseSystemRole(t) ?? parseSystemRole(t.toLowerCase())
  if (direct) return direct
  for (const [k, label] of Object.entries(SYSTEM_ROLE_LABEL)) {
    if (label === t) return k as SystemRoleValue
  }
  return null
}
