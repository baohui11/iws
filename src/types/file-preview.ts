/** Excel 解析预览（Python xlsx 等写入的 JSON，结构可扩展） */

/** 单元格：纯量或带样式对象 */
export type ExcelPreviewCell =
  | string
  | number
  | null
  | undefined
  | { v?: string | number | null; style?: Record<string, string> }

export interface ExcelPreviewSheet {
  name?: string
  /** 简单二维单元格（可含带 v/style 的对象） */
  rows?: ExcelPreviewCell[][]
  /** 或带样式的单元格列表 */
  cells?: {
    r: number
    c: number
    v?: string | number | null
    style?: Record<string, string>
  }[]
}

export interface ExcelPreviewJson {
  sheets?: ExcelPreviewSheet[]
  /** 兼容整表单行数组 */
  rows?: ExcelPreviewCell[][]
}

export type FilePreviewPayload =
  | { kind: 'unsupported'; message: string }
  | { kind: 'text'; text: string }
  | { kind: 'csv'; rows: string[][]; truncated: boolean }
  | { kind: 'markdown'; text: string }
  | { kind: 'image'; signedUrl: string }
  | { kind: 'pdf'; signedUrl: string }
  | { kind: 'media'; signedUrl: string; media: 'video' | 'audio' }
  | { kind: 'excel'; data: unknown }

export interface FilePreviewRecommendUser {
  userId: string
  name: string
  avatarUrl: string | null
}

export interface FilePreviewRecommendStats {
  count: number
  sampleUsers: FilePreviewRecommendUser[]
}

export interface FilePreviewCommentRow {
  id: string
  parentId: string | null
  /** 所属楼（一级评论）的 id；一级评论自身等于 id */
  rootCommentId: string
  content: string
  createdAt: string
  userName: string
  userId: string
  avatarUrl: string | null
  /** 被回复者展示名，用于 @ */
  replyToUserName: string | null
}

export interface FilePreviewLoadResult {
  fileId: string
  fileName: string
  fileSize: number
  fileExt: string | null
  /** 是否有权查看实际预览内容（下载同源） */
  canPreview: boolean
  /** 上传者展示名 */
  uploaderName: string
  payload: FilePreviewPayload
  interactions: { favorite: boolean; recommend: boolean }
  recommendStats: FilePreviewRecommendStats
  comments: FilePreviewCommentRow[]
}
