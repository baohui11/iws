import {
  PROJECT_STAGE_IMPLEMENTATION,
  PROJECT_STAGE_SALES,
  parseProjectStage,
} from '@/constants/project-stage'

/**
 * 与数据库 enum project_roles 一致。
 * 客户端请从此处引用，勿从 @/types/database 导入。
 */
export const PROJECT_ROLE_VALUES = [
  'pm',
  'member',
  'director',
  'sale_ld',
] as const

export type ProjectRoleValue = (typeof PROJECT_ROLE_VALUES)[number]

export const PROJECT_ROLE_LABEL: Record<ProjectRoleValue, string> = {
  pm: '项目经理',
  member: '项目成员',
  director: '项目总监',
  sale_ld: '销售LD',
}

/** 实施阶段可选角色 */
export const PROJECT_ROLES_BY_STAGE_IMPLEMENTATION: readonly ProjectRoleValue[] =
  ['pm', 'member', 'director']

/** 销售阶段可选角色 */
export const PROJECT_ROLES_BY_STAGE_SALES: readonly ProjectRoleValue[] = [
  'pm',
  'member',
  'sale_ld',
]

export function projectRolesForStage(
  stage: string | null | undefined,
): readonly ProjectRoleValue[] {
  const s = parseProjectStage(stage)
  if (s === PROJECT_STAGE_SALES) return PROJECT_ROLES_BY_STAGE_SALES
  if (s === PROJECT_STAGE_IMPLEMENTATION) return PROJECT_ROLES_BY_STAGE_IMPLEMENTATION
  return PROJECT_ROLE_VALUES
}

export function isProjectRoleAllowedForStage(
  stage: string | null | undefined,
  role: ProjectRoleValue | null,
): boolean {
  if (!role) return false
  return projectRolesForStage(stage).includes(role)
}

export function parseProjectRole(value: string | null | undefined): ProjectRoleValue | null {
  if (value == null || value === '') return null
  return PROJECT_ROLE_VALUES.includes(value as ProjectRoleValue)
    ? (value as ProjectRoleValue)
    : null
}

/** CSV/导入：支持英文枚举或中文标签 */
export function parseProjectRoleFromImport(raw: string): ProjectRoleValue | null {
  const t = raw.trim()
  if (!t) return null
  const direct = parseProjectRole(t) ?? parseProjectRole(t.toLowerCase())
  if (direct) return direct
  for (const [k, label] of Object.entries(PROJECT_ROLE_LABEL)) {
    if (label === t) return k as ProjectRoleValue
  }
  if (t === '销售LD' || t === '销售ld') return 'sale_ld'
  return null
}
