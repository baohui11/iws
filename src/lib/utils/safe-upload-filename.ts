/** 从路径字符串中只取最后一段文件名，防止 `../` */
export function getBasenameOnly(name: string): string {
  const base = name.replace(/\\/g, '/').split('/').pop() ?? 'file'
  return base.trim() || 'file'
}

/** 用于 Storage 路径中的一段文件名（不含目录） */
export function sanitizeStorageFilenameSegment(name: string): string {
  const base = getBasenameOnly(name)
  const cleaned = base.replace(/[^\w.\-\u4e00-\u9fff]/g, '_')
  return cleaned.slice(0, 200) || 'file'
}

export function fileExtLower(name: string): string | null {
  const base = getBasenameOnly(name)
  const i = base.lastIndexOf('.')
  if (i < 0 || i === base.length - 1) return null
  return base.slice(i + 1).toLowerCase()
}
