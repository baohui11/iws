/** 与数据库 enum project_status 一致。 */
export const PROJECT_STATUS_VALUES = [
  '进行中',
  '预结项',
  '已结项',
  '终止',
  '已关闭',
] as const

export type ProjectStatusValue = (typeof PROJECT_STATUS_VALUES)[number]

export const PROJECT_STATUS_LABEL: Record<ProjectStatusValue, string> = {
  进行中: '进行中',
  预结项: '预结项',
  已结项: '已结项',
  终止: '终止',
  已关闭: '已关闭',
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
