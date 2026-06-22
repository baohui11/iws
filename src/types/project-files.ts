/**
 * 我的项目文件（public.files）列表与上传侧类型，手写以保持与 DB 一致且不依赖 database.ts 生成类型。
 */

import type { ProjectFileTypeCategory } from '@/lib/utils/project-file-type-category'

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
  file_source: string | null
  is_latest: boolean
}

export type ProjectFilesScope = 'all' | 'deliverable' | 'reference'

export interface ListProjectFilesFilters {
  scope: ProjectFilesScope
  /** 成果：仅关联合同清单项 */
  contractDeliverOnly?: boolean
  /** 成果：仅最新版本 */
  latestOnly?: boolean
  /** 参考资料：file_source；all 表示不限 */
  referenceSource?: string
  /** 文件类型分类；all 表示不限 */
  typeCategory?: ProjectFileTypeCategory
}
