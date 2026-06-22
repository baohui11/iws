/** 参考资料 file_source 展示与分组（与 DB 枚举一致） */
export const REFERENCE_FILE_SOURCE_LABEL: Record<string, string> = {
  client: '客户资料',
  internal: '内部资料',
  public: '公开资料',
  original: '原创',
}

export function referenceFileSourceLabel(source: string | null | undefined): string {
  if (!source || source === 'unknown') return '其他'
  return REFERENCE_FILE_SOURCE_LABEL[source] ?? source
}

export const REFERENCE_SOURCE_GROUP_ORDER = [
  'client',
  'internal',
  'public',
  'original',
] as const

export function groupReferenceFilesByOrderedSource<
  T extends { file_source?: string | null },
>(files: T[]): { key: string; label: string; items: T[] }[] {
  const map = new Map<string, T[]>()
  for (const f of files) {
    const k = (f.file_source ?? 'unknown').trim() || 'unknown'
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(f)
  }
  const seen = new Set<string>()
  const out: { key: string; label: string; items: T[] }[] = []
  for (const key of REFERENCE_SOURCE_GROUP_ORDER) {
    if (map.has(key)) {
      out.push({
        key,
        label: referenceFileSourceLabel(key),
        items: map.get(key)!,
      })
      seen.add(key)
    }
  }
  for (const key of map.keys()) {
    if (!seen.has(key)) {
      out.push({
        key,
        label: referenceFileSourceLabel(key),
        items: map.get(key)!,
      })
    }
  }
  return out
}
