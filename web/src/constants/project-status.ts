/** 与数据库 enum project_status 一致。 */
export const PROJECT_STATUS_VALUES = [
  'active',
  'preparing',
  'completed',
  'archived',
  'suspended',
] as const

export type ProjectStatusValue = (typeof PROJECT_STATUS_VALUES)[number]

export const PROJECT_STATUS_LABEL: Record<ProjectStatusValue, string> = {
  active: '进行中',
  preparing: '筹备',
  completed: '已完成',
  archived: '已归档',
  suspended: '已暂停',
}

export function parseProjectStatus(
  value: string | null | undefined
): ProjectStatusValue | null {
  if (value == null || value === '') return null
  const t = value.trim()
  return PROJECT_STATUS_VALUES.includes(t as ProjectStatusValue)
    ? (t as ProjectStatusValue)
    : null
}
