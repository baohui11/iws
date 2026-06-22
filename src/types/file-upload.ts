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
