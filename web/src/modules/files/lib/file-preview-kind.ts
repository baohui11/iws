/** 根据扩展名判断预览策略（小写） */

export const PREVIEW_IMAGE_EXT = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'svg',
])

export const PREVIEW_AUDIO_EXT = new Set([
  'mp3',
  'wav',
  'aac',
  'ogg',
  'm4a',
  'flac',
])

export const PREVIEW_VIDEO_EXT = new Set(['mp4', 'webm', 'ogg', 'mov'])

export const PREVIEW_OFFICE_NEED_PDF = new Set([
  'doc',
  'docx',
  'ppt',
  'pptx',
])

export const PREVIEW_EXCEL_EXT = new Set(['xlsx', 'xls'])

export const MB50 = 50 * 1024 * 1024

export const MAX_TEXT_PREVIEW_BYTES = 2 * 1024 * 1024

export const MAX_CSV_ROWS = 50

export const MAX_CSV_COLS = 24

export function normalizeExt(fileExt: string | null | undefined): string {
  return (fileExt ?? '').trim().replace(/^\./, '').toLowerCase()
}

function hasPdfPreview(
  previewStatus: string | null,
  previewKey: string | null
): boolean {
  return previewStatus === 'ready' && !!previewKey?.trim()
}

export type ResolvedPreviewStrategy =
  | 'image'
  | 'pdf_source'
  | 'pdf_preview'
  | 'text'
  | 'csv'
  | 'markdown'
  | 'excel'
  | 'media_video'
  | 'media_audio'
  | 'unsupported_large_media'
  | 'unsupported_no_pdf'
  | 'unsupported'

/**
 * 返回如何预览；具体 URL / 文本由 action 再拉存储
 */
export function resolvePreviewStrategy(params: {
  ext: string
  fileSize: number
  previewStatus: string | null
  previewStorageKey: string | null
  hasExcelJson: boolean
}): ResolvedPreviewStrategy {
  const { ext, fileSize, previewStatus, previewStorageKey, hasExcelJson } =
    params

  if (PREVIEW_IMAGE_EXT.has(ext)) return 'image'

  if (ext === 'pdf') return 'pdf_source'

  if (PREVIEW_OFFICE_NEED_PDF.has(ext)) {
    if (hasPdfPreview(previewStatus, previewStorageKey)) {
      return 'pdf_preview'
    }
    return 'unsupported_no_pdf'
  }

  if (PREVIEW_EXCEL_EXT.has(ext)) {
    if (hasExcelJson) return 'excel'
    return 'unsupported'
  }

  if (ext === 'txt' || ext === 'log') return 'text'

  if (ext === 'csv' || ext === 'tsv') return 'csv'

  if (ext === 'md' || ext === 'markdown') return 'markdown'

  if (PREVIEW_VIDEO_EXT.has(ext)) {
    if (fileSize <= MB50) return 'media_video'
    return 'unsupported_large_media'
  }

  if (PREVIEW_AUDIO_EXT.has(ext)) {
    if (fileSize <= MB50) return 'media_audio'
    return 'unsupported_large_media'
  }

  return 'unsupported'
}
