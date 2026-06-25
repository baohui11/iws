import { fileExtLower } from '@/modules/files/lib/safe-upload-filename'

/** 与 `public/icons/file-types/*.svg` 对应 */
const BASE = '/icons/file-types'

/**
 * 根据扩展名返回静态图标路径（`public/icons/file-types`）。
 * 无匹配类型时使用 `unknown.svg`。
 */
export function getFileTypeIconSrc(fileName: string): string {
  const ext = fileExtLower(fileName)?.toLowerCase() ?? ''

  if (ext === 'pdf') return `${BASE}/pdf.svg`
  if (['doc', 'docx', 'docm'].includes(ext)) return `${BASE}/word.svg`
  if (['ppt', 'pptx', 'pptm'].includes(ext)) return `${BASE}/ppt.svg`
  if (ext === 'txt') return `${BASE}/txt.svg`
  if (['md', 'mdx', 'markdown'].includes(ext)) return `${BASE}/markdown.svg`
  if (
    [
      'mp4',
      'webm',
      'mov',
      'avi',
      'mkv',
      'wmv',
      'flv',
      'm4v',
      'mpeg',
      'mpg',
      '3gp',
    ].includes(ext)
  ) {
    return `${BASE}/video.svg`
  }
  if (['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'wma', 'ape'].includes(ext)) {
    return `${BASE}/audio.svg`
  }
  if (['xmind', 'mm', 'mmap'].includes(ext)) return `${BASE}/mindmap.svg`
  if (['xls', 'xlsx', 'xlsm', 'xlsb', 'csv'].includes(ext)) {
    return `${BASE}/excel.svg`
  }
  if (
    [
      'png',
      'jpg',
      'jpeg',
      'gif',
      'webp',
      'bmp',
      'ico',
      'svg',
      'tif',
      'tiff',
      'heic',
    ].includes(ext)
  ) {
    return `${BASE}/image.svg`
  }

  return `${BASE}/unknown.svg`
}
