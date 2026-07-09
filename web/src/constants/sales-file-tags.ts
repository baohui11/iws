export const SALES_FILE_TAG_OPTIONS = [
  '软课题可研立项',
  '管理创新可研立项',
  '沟通材料',
  '项目建议书',
  '招采文件筹备',
] as const

export type SalesFileTagPreset = (typeof SALES_FILE_TAG_OPTIONS)[number]

export function normalizeSalesFileTag(value: string | null | undefined): string {
  return value?.trim() ?? ''
}
