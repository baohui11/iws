import type { ProjectFileTypeCategory } from '@/modules/files/lib/project-file-type-category'
import type { ProjectStageValue } from '@/constants/project-stage'

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
  originalFileName: string | null
  fileSize: number
  fileExt: string | null
  mimeType: string | null
  createdAt: string
  projectId: string
  projectName: string | null
  projectNo: string | null
  departmentName: string | null
  projectStage: string | null
  isConfidential: boolean
  isDeliverable: boolean
  fileSource: string | null
  salesFileTag: string | null
  businessType: string | null
  contractDeliverableName: string | null
  versionGroupId: string
  versionNo: number
  versionLabel: string | null
  isLatest: boolean | null
  /** 是否有权查看实际预览内容（下载同源） */
  canPreview: boolean
  /** 上传者展示名 */
  uploaderName: string
  viewerName: string
  processStatus: {
    preview: string | null
    parse: string | null
    index: string | null
  }
  payload: FilePreviewPayload
  interactions: { favorite: boolean; recommend: boolean }
  recommendStats: FilePreviewRecommendStats
  comments: FilePreviewCommentRow[]
  versions: FilePreviewVersionRow[]
  chunks: FilePreviewChunkRow[]
  chunkTotal: number
}

export interface FilePreviewVersionRow {
  fileId: string
  fileName: string
  versionNo: number
  versionLabel: string | null
  isLatest: boolean | null
  createdAt: string
}

export interface FilePreviewChunkRow {
  id: string
  chunkIndex: number
  content: string
  pageNo: number | null
  slideNo: number | null
  sheetName: string | null
  rowStart: number | null
  rowEnd: number | null
  sectionTitle: string | null
}

/** 与 DB file_source 一致；若库中已增加枚举值，在此补充 */
export type FileSourceValue =
  | 'client'
  | 'internal'
  | 'public'
  | 'original'

export interface MemberActiveProjectOption {
  id: string
  project_no: string | null
  project_name: string | null
  available_project_stages: ProjectStageValue[]
}

export interface ContractDeliverableOption {
  id: string
  name: string
  description: string | null
}

export interface ExistingDeliverableFileOption {
  id: string
  file_name: string
  version_label: string | null
  version_group_id: string
  contract_deliverable_id: string | null
}

export interface ReferenceFileOption {
  id: string
  file_name: string
  /** 与 files.file_source 一致，用于按资料类型分组展示 */
  file_source: string
  /** ISO 时间，用于展示上传时间 */
  created_at: string
}

export interface FileUploadOptionsPayload {
  deliverables: ContractDeliverableOption[]
  existingDeliverableFiles: ExistingDeliverableFileOption[]
  referenceFiles: ReferenceFileOption[]
}

/** 与检索服务 POST /v1/search 的 filters 键一致（见 docs/检索接口文档.md） */
export type DocSearchFilterKey =
  | 'department_id'
  | 'project_id'
  | 'uploader_id'
  | 'project_stage'
  | 'department_name'
  | 'project_name'
  | 'file_name'
  | 'file_type'
  | 'file_ext'
  | 'is_confidential'
  | 'content_degraded'

export type DocSearchFilters = Partial<
  Record<DocSearchFilterKey, string | boolean>
>

export type DocSearchMode = 'hybrid' | 'keyword' | 'semantic' | 'metadata'

export interface DocSearchRequestBody {
  q?: string
  mode?: DocSearchMode
  limit?: number
  offset?: number
  filters?: DocSearchFilters
  crop_length?: number
  max_content_chars?: number
}

export interface DocSearchHitFormatted {
  content?: string
  file_name?: string
}

export interface DocSearchSnippet {
  content: string
  formatted?: string
  page_no?: number | null
  slide_no?: number | null
  sheet_name?: string | null
  row_start?: number | null
  row_end?: number | null
  chunk_index: number
  rank_score?: number | null
}

export interface DocSearchHit {
  id: string
  content?: string
  snippets?: DocSearchSnippet[]
  _formatted?: DocSearchHitFormatted
  content_degraded?: boolean
  file_name?: string
  file_ext?: string
  file_type?: string
  project_id?: string
  project_name?: string
  uploader_id?: string
  uploader_name?: string
  department_id?: string
  department_name?: string
  source_storage_key?: string
  created_at?: string
  project_stage?: string
  is_confidential?: boolean
  can_access_content?: boolean
  matched_by?: 'metadata' | 'fulltext' | 'vector' | 'hybrid'
  metadata_score?: number | null
  keyword_score?: number | null
  vector_score?: number | null
  final_score?: number | null
  disabled_reason?: string
}

export interface DocSearchResponse {
  hits: DocSearchHit[]
  query: string
  mode?: DocSearchMode
  limit: number
  offset: number
  estimatedTotalHits: number | null
  processingTimeMs: number | null
}

/**
 * 我的项目文件（public.files）列表与上传侧类型，手写以保持与 DB 一致且不依赖 database.ts 生成类型。
 */

/** 列表展示 */
export interface ProjectFileListRow {
  id: string
  file_name: string
  file_size: number
  file_ext: string | null
  mime_type: string | null
  source_storage_key: string
  created_at: string
  uploader_name: string | null
  is_confidential: boolean
  is_deliverable: boolean
  contract_deliverable_id: string | null
  project_stage: ProjectStageValue
  sales_file_tag: string | null
  file_source: string | null
  is_latest: boolean
}

export type ProjectFilesScope = 'all' | 'deliverable' | 'reference'

export interface ListProjectFilesFilters {
  scope: ProjectFilesScope
  projectStage?: ProjectStageValue
  /** 成果：仅关联合同清单项 */
  contractDeliverOnly?: boolean
  /** 成果：仅最新版本 */
  latestOnly?: boolean
  /** 参考资料：file_source；all 表示不限 */
  referenceSource?: string
  /** 文件类型分类；all 表示不限 */
  typeCategory?: ProjectFileTypeCategory
}

/** 与表 file_interactions.interaction_type 一致 */
export type FileInteractionTypeValue = 'recommend' | 'favorite'

export {
  FILE_INTERACTION_USER_ROLE_AT_UPLOAD,
  FILE_INTERACTION_USER_ROLE_AT_VIEWER,
} from '@/constants/file-interactions'

export interface FileRowPreview {
  id: string
  project_id: string
  department_id: string | null
  project_stage: ProjectStageValue
  project_name: string | null
  project_no: string | null
  department_name: string | null
  file_name: string
  original_file_name: string | null
  file_size: number
  file_ext: string | null
  mime_type: string | null
  source_storage_key: string
  preview_storage_key: string | null
  preview_status: string | null
  parse_status: string | null
  index_status: string | null
  /** 客户敏感文件 */
  is_confidential: boolean
  is_deliverable: boolean
  file_source: string | null
  sales_file_tag: string | null
  business_type: string | null
  contract_deliverable_name: string | null
  version_group_id: string
  version_no: number
  version_label: string | null
  is_latest: boolean | null
  created_at: string
  uploader_id: string
  /** 上传者展示名 */
  uploader_name: string
}

/** 我的文件列表每页条数（与滚动加载一致） */
export const MINE_FILES_PAGE_SIZE = 20

export interface MineFileRow {
  file_id: string
  file_name: string
  project_id: string
  project_name: string | null
  project_stage: ProjectStageValue
  is_deliverable: boolean
  file_source: string | null
  sales_file_tag: string | null
  /** 列表排序用：文件创建时间 */
  sort_at: string
}

export interface MineFilesPageResult {
  rows: MineFileRow[]
  hasMore: boolean
}

export interface InsertDeliverableFileInput {
  id: string
  projectId: string
  fileName: string
  fileSize: number
  fileExt: string | null
  mimeType: string | null
  sourceStorageKey: string
  uploaderId: string
  versionGroupId: string
  versionNo: number
  versionLabel: string
  /** 非合同成果时为 null */
  contractDeliverableId: string | null
  projectStage: ProjectStageValue
  salesFileTag: string | null
  fileSource: string
  isConfidential: boolean
}

export interface InsertReferenceFileInput {
  id: string
  projectId: string
  fileName: string
  fileSize: number
  fileExt: string | null
  mimeType: string | null
  sourceStorageKey: string
  uploaderId: string
  projectStage: ProjectStageValue
  salesFileTag: string | null
  fileSource: string
  isConfidential: boolean
}
