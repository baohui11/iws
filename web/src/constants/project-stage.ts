/** 与数据库 enum project_stage 一致：实施阶段、销售阶段。 */
export const PROJECT_STAGE_IMPLEMENTATION = '实施阶段' as const
export const PROJECT_STAGE_SALES = '销售阶段' as const

export const PROJECT_STAGE_VALUES = [
  PROJECT_STAGE_IMPLEMENTATION,
  PROJECT_STAGE_SALES,
] as const

export type ProjectStageValue = (typeof PROJECT_STAGE_VALUES)[number]

export const PROJECT_STAGE_LABEL: Record<ProjectStageValue, string> = {
  [PROJECT_STAGE_IMPLEMENTATION]: '实施阶段',
  [PROJECT_STAGE_SALES]: '销售阶段',
}

export function parseProjectStage(
  value: string | null | undefined
): ProjectStageValue | null {
  if (value == null || value === '') return null
  const t = value.trim()
  return PROJECT_STAGE_VALUES.includes(t as ProjectStageValue)
    ? (t as ProjectStageValue)
    : null
}

export function parseProjectStageFromImport(
  raw: string
): ProjectStageValue | null {
  const t = raw.trim()
  if (!t) return null
  const direct = parseProjectStage(t)
  if (direct) return direct
  const lower = t.toLowerCase()
  if (lower === 'implementation' || lower === '实施')
    return PROJECT_STAGE_IMPLEMENTATION
  if (lower === 'sales' || lower === '销售') return PROJECT_STAGE_SALES
  return null
}
