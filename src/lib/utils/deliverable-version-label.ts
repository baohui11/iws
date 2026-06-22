import type { ParsedDeliverableFilename } from '@/lib/utils/deliverable-filename'

/**
 * 成果版本号：优先使用用户输入（可带或不带 V 前缀），空则回退文件名解析，再无则 V1。
 */
export function resolveDeliverableVersionLabelForDb(
  rawInput: string,
  parsed: ParsedDeliverableFilename | null
): string {
  const t = rawInput.trim()
  if (t) {
    const inner = t.replace(/^v\s*/i, '').trim()
    return inner ? `V${inner}` : (parsed?.versionLabel ?? 'V1')
  }
  return parsed?.versionLabel ?? 'V1'
}
