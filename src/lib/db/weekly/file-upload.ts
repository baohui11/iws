import { randomUUID } from 'node:crypto'

import { createClient } from '@/lib/supabase/server'
import { handleDbError } from '@/lib/db/handle-db-error'
import type {
  ContractDeliverableOption,
  ExistingDeliverableFileOption,
  MemberActiveProjectOption,
  ReferenceFileOption,
} from '@/types/file-upload'

type ServerClient = Awaited<ReturnType<typeof createClient>>

/** 当前用户为成员且项目状态为「进行中」 */
export async function listMemberActiveProjectsForUpload(
  userId: string
): Promise<MemberActiveProjectOption[]> {
  const supabase = await createClient()
  const { data: mems, error: e0 } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('user_id', userId)
    .is('deleted_at', null)
  if (e0) handleDbError(e0)
  const ids = [...new Set((mems ?? []).map((m) => m.project_id).filter(Boolean))] as string[]
  if (!ids.length) return []

  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, project_no, project_name, project_status')
    .in('id', ids)
    .eq('project_status', 'active')
    .is('deleted_at', null)
    .order('project_no', { ascending: true })

  if (error) handleDbError(error)
  return (projects ?? []).map((p) => ({
    id: p.id,
    project_no: p.project_no,
    project_name: p.project_name,
  }))
}

export async function listContractDeliverablesForProject(
  projectId: string
): Promise<ContractDeliverableOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('contract_deliverables')
    .select('id, name, description')
    .eq('project_id', projectId)
    .order('name', { ascending: true })

  if (error) handleDbError(error)
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
  }))
}

export async function listExistingDeliverableFilesForProject(
  projectId: string
): Promise<ExistingDeliverableFileOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('files')
    .select(
      'id, file_name, version_label, version_group_id, contract_deliverable_id'
    )
    .eq('project_id', projectId)
    .eq('is_deliverable', true)
    .eq('is_latest', true)
    .order('created_at', { ascending: false })

  if (error) handleDbError(error)
  return (data ?? []).map((r) => ({
    id: r.id,
    file_name: r.file_name,
    version_label: r.version_label,
    version_group_id: r.version_group_id,
    contract_deliverable_id: r.contract_deliverable_id,
  }))
}

export async function listReferenceFilesForProject(
  projectId: string
): Promise<ReferenceFileOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('files')
    .select('id, file_name, file_source, created_at')
    .eq('project_id', projectId)
    .eq('is_deliverable', false)
    .eq('is_latest', true)
    .order('created_at', { ascending: false })

  if (error) handleDbError(error)
  return (data ?? []).map((r) => ({
    id: r.id,
    file_name: r.file_name,
    file_source: r.file_source ?? 'internal',
    created_at: r.created_at ?? '',
  }))
}

export async function getDeliverableFileRow(
  fileId: string
): Promise<{
  version_group_id: string
  contract_deliverable_id: string | null
  project_id: string
  is_latest: boolean
  is_deliverable: boolean
  file_name: string | null
} | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('files')
    .select(
      'version_group_id, contract_deliverable_id, project_id, is_latest, is_deliverable, file_name'
    )
    .eq('id', fileId)
    .maybeSingle()
  if (error) handleDbError(error)
  if (!data) return null
  return {
    version_group_id: data.version_group_id,
    contract_deliverable_id: data.contract_deliverable_id,
    project_id: data.project_id,
    is_latest: data.is_latest ?? false,
    is_deliverable: data.is_deliverable ?? false,
    file_name: data.file_name,
  }
}

/** 同一版本组内是否已有相同 version_label */
export async function existsDeliverableVersionInGroup(
  versionGroupId: string,
  versionLabel: string
): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('files')
    .select('id')
    .eq('version_group_id', versionGroupId)
    .eq('version_label', versionLabel)
    .eq('is_deliverable', true)
    .limit(1)
    .maybeSingle()
  if (error) handleDbError(error)
  return !!data
}

/** 项目内参考资料：同名最新一条 */
export async function existsReferenceDuplicateName(
  projectId: string,
  fileName: string
): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('files')
    .select('id')
    .eq('project_id', projectId)
    .eq('file_name', fileName)
    .eq('is_deliverable', false)
    .eq('is_latest', true)
    .limit(1)
    .maybeSingle()
  if (error) handleDbError(error)
  return !!data
}

export async function getNextVersionNoInGroup(
  supabase: ServerClient,
  versionGroupId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('files')
    .select('version_no')
    .eq('version_group_id', versionGroupId)
    .order('version_no', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) handleDbError(error)
  const n = data?.version_no
  if (typeof n !== 'number' || !Number.isFinite(n)) return 1
  return n + 1
}

export async function markGroupFilesNotLatest(
  supabase: ServerClient,
  versionGroupId: string
): Promise<void> {
  const { error } = await supabase
    .from('files')
    .update({ is_latest: false })
    .eq('version_group_id', versionGroupId)
    .eq('is_latest', true)
  if (error) handleDbError(error)
}

export async function insertFileReferenceLinks(
  supabase: ServerClient,
  deliverableFileId: string,
  referenceFileIds: string[]
): Promise<void> {
  const unique = [...new Set(referenceFileIds.filter(Boolean))]
  if (!unique.length) return
  const rows = unique.map((reference_file_id) => ({
    reference_file_id,
    deliverable_file_id: deliverableFileId,
  }))
  const { error } = await supabase.from('file_reference_links').insert(rows)
  if (error) handleDbError(error)
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
  fileSource: string
  isConfidential: boolean
}

export async function insertDeliverableFileRow(
  supabase: ServerClient,
  input: InsertDeliverableFileInput
): Promise<void> {
  const { error } = await supabase.from('files').insert({
    id: input.id,
    project_id: input.projectId,
    file_name: input.fileName,
    file_size: input.fileSize,
    file_ext: input.fileExt,
    mime_type: input.mimeType,
    source_storage_key: input.sourceStorageKey,
    uploader_id: input.uploaderId,
    version_group_id: input.versionGroupId,
    version_no: input.versionNo,
    version_label: input.versionLabel,
    is_latest: true,
    is_deliverable: true,
    contract_deliverable_id: input.contractDeliverableId,
    file_source: input.fileSource,
    is_confidential: input.isConfidential,
    preview_status: 'pending',
  })
  if (error) handleDbError(error)
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
  fileSource: string
  isConfidential: boolean
}

export async function insertReferenceFileRow(
  supabase: ServerClient,
  input: InsertReferenceFileInput
): Promise<void> {
  const vg = randomUUID()
  const { error } = await supabase.from('files').insert({
    id: input.id,
    project_id: input.projectId,
    file_name: input.fileName,
    file_size: input.fileSize,
    file_ext: input.fileExt,
    mime_type: input.mimeType,
    source_storage_key: input.sourceStorageKey,
    uploader_id: input.uploaderId,
    version_group_id: vg,
    version_no: 1,
    version_label: null,
    is_latest: true,
    is_deliverable: false,
    contract_deliverable_id: null,
    file_source: input.fileSource,
    is_confidential: input.isConfidential,
    preview_status: 'pending',
  })
  if (error) handleDbError(error)
}

export async function getContractDeliverableName(
  supabase: ServerClient,
  id: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('contract_deliverables')
    .select('name')
    .eq('id', id)
    .maybeSingle()
  if (error) handleDbError(error)
  return data?.name?.trim() ?? null
}
