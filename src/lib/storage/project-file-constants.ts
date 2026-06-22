/**
 * 项目文件存储（与头像 bucket 分离；需在 Supabase 创建 bucket 并配置策略）
 *
 * 环境变量：
 * - `IWS_PROJECT_FILES_BUCKET`：Storage bucket 名，默认 `project-files`
 * - `IWS_PROJECT_FILES_MAX_BYTES`：单文件最大字节数，默认 524288000（500MB）
 */

const DEFAULT_MAX_BYTES = 500 * 1024 * 1024

export function getProjectFilesBucket(): string {
  return process.env.IWS_PROJECT_FILES_BUCKET?.trim() || 'project-files'
}

export function getMaxProjectFileBytes(): number {
  const raw = process.env.IWS_PROJECT_FILES_MAX_BYTES?.trim()
  if (!raw) return DEFAULT_MAX_BYTES
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1024 * 1024) return DEFAULT_MAX_BYTES
  return Math.min(n, 1024 * 1024 * 1024 * 2)
}

/** 用于 UI 展示 */
export function formatMaxProjectFileLabel(): string {
  const b = getMaxProjectFileBytes()
  if (b >= 1024 * 1024 * 1024) {
    return `${(b / (1024 * 1024 * 1024)).toFixed(0)} GB`
  }
  if (b >= 1024 * 1024) {
    return `${Math.round(b / (1024 * 1024))} MB`
  }
  return `${Math.round(b / 1024)} KB`
}

/** 禁止上传的高风险扩展名（小写，不含点） */
export const PROJECT_FILE_BLOCKED_EXT = new Set([
  'exe',
  'bat',
  'cmd',
  'com',
  'msi',
  'scr',
  'pif',
  'vbs',
  'jse',
  'wsf',
  'wsh',
  'msc',
  'msp',
  'hta',
  'cpl',
  'msh',
  'reg',
  'ps1',
  'app',
  'deb',
  'rpm',
  'dll',
  'sys',
])

/**
 * 项目文件上传允许的扩展名（小写，不含点）。
 * PDF、Word、Excel、PPT、CSV、Markdown、TXT、思维导图、视频、音频、图片；不含压缩包等。
 */
export const PROJECT_FILE_ALLOWED_EXT = new Set([
  'pdf',
  'doc',
  'docx',
  'docm',
  'xls',
  'xlsx',
  'xlsm',
  'xlsb',
  'csv',
  'ppt',
  'pptx',
  'pptm',
  'md',
  'mdx',
  'markdown',
  'txt',
  'xmind',
  'mm',
  'mmap',
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
  'mp3',
  'wav',
  'flac',
  'aac',
  'm4a',
  'ogg',
  'wma',
  'ape',
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
])

export function isAllowedProjectFileExtension(extLower: string | null): boolean {
  if (!extLower) return false
  return PROJECT_FILE_ALLOWED_EXT.has(extLower.toLowerCase())
}

/** 供 `<input type="file" accept="…">` 使用 */
export function getProjectFileUploadAcceptAttribute(): string {
  return [...PROJECT_FILE_ALLOWED_EXT].sort().map((e) => `.${e}`).join(',')
}

/** 上传校验失败时的说明文案 */
export const PROJECT_FILE_ALLOWED_EXT_HINT =
  '仅支持 PDF、Word、Excel、PPT、CSV、Markdown、TXT、思维导图、视频、音频、图片；不支持压缩包等其它类型'
