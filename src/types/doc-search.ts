/** 与检索服务 POST /v1/search 的 filters 键一致（见 docs/检索接口文档.md） */
export type DocSearchFilterKey =
  | 'department_id'
  | 'project_id'
  | 'uploader_id'
  | 'department_name'
  | 'project_name'
  | 'file_name'
  | 'file_type'
  | 'file_ext'
  | 'content_degraded'

export type DocSearchFilters = Partial<
  Record<DocSearchFilterKey, string | boolean>
>

export interface DocSearchRequestBody {
  q?: string
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

export interface DocSearchHit {
  id: string
  content?: string
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
}

export interface DocSearchResponse {
  hits: DocSearchHit[]
  query: string
  limit: number
  offset: number
  estimatedTotalHits: number | null
  processingTimeMs: number | null
}
