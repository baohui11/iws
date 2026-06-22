/**
 * 项目文件列表「文件类型」筛选：与 `file-type-icon` 扩展名划分一致。
 * `other` 表示不在下列已知扩展名集合内的文件（含 file_ext 为空）。
 */

export type ProjectFileTypeCategory =
  | 'all'
  | 'ppt'
  | 'pdf'
  | 'word'
  | 'excel'
  | 'image'
  | 'video'
  | 'audio'
  | 'mindmap'
  | 'markdown'
  | 'text'
  | 'other'

export const PROJECT_FILE_TYPE_CATEGORY_LABEL: Record<ProjectFileTypeCategory, string> =
  {
    all: '全部类型',
    ppt: 'PPT',
    pdf: 'PDF',
    word: 'Word',
    excel: 'Excel',
    image: '图片',
    video: '视频',
    audio: '音频',
    mindmap: '思维导图',
    markdown: 'Markdown',
    text: '文本',
    other: '其他',
  }

const PPT = ['ppt', 'pptx', 'pptm'] as const
const WORD = ['doc', 'docx', 'docm'] as const
const EXCEL = ['xls', 'xlsx', 'xlsm', 'xlsb', 'csv'] as const
const IMAGE = [
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
] as const
const VIDEO = [
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
] as const
const AUDIO = [
  'mp3',
  'wav',
  'flac',
  'aac',
  'm4a',
  'ogg',
  'wma',
  'ape',
] as const
const MINDMAP = ['xmind', 'mm', 'mmap'] as const
const MARKDOWN = ['md', 'mdx', 'markdown'] as const
const TEXT = ['txt', 'log', 'rtf', 'rst', 'ini', 'cfg', 'properties'] as const
const PDF = ['pdf'] as const

export const PROJECT_FILE_TYPE_CATEGORY_EXTS: Record<
  Exclude<ProjectFileTypeCategory, 'all' | 'other'>,
  readonly string[]
> = {
  ppt: PPT,
  pdf: PDF,
  word: WORD,
  excel: EXCEL,
  image: IMAGE,
  video: VIDEO,
  audio: AUDIO,
  mindmap: MINDMAP,
  markdown: MARKDOWN,
  text: TEXT,
}

/** 所有「已知类型」扩展名并集，用于「其他」筛选 */
export const PROJECT_FILE_ALL_KNOWN_EXTS: string[] = [
  ...new Set(
    Object.values(PROJECT_FILE_TYPE_CATEGORY_EXTS).flat() as string[]
  ),
].sort()

export function getExtsForTypeCategory(
  cat: ProjectFileTypeCategory
): string[] | null {
  if (cat === 'all') return null
  if (cat === 'other') return null
  return [...PROJECT_FILE_TYPE_CATEGORY_EXTS[cat]]
}
