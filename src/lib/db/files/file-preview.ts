import { createClient } from '@/lib/supabase/server'
import { handleDbError } from '@/lib/db/handle-db-error'
import type { Json } from '@/types/database'

export interface FileRowPreview {
  id: string
  project_id: string
  file_name: string
  file_size: number
  file_ext: string | null
  mime_type: string | null
  source_storage_key: string
  preview_storage_key: string | null
  preview_status: string | null
  /** 客户敏感文件 */
  is_confidential: boolean
  uploader_id: string
  /** 上传者展示名 */
  uploader_name: string
}

export async function getFileRowForPreview(
  fileId: string
): Promise<FileRowPreview | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('files')
    .select(
      `
      id,
      project_id,
      file_name,
      file_size,
      file_ext,
      mime_type,
      source_storage_key,
      preview_storage_key,
      preview_status,
      is_confidential,
      uploader_id,
      uploader:users!files_uploader_id_fkey(name)
    `
    )
    .eq('id', fileId)
    .maybeSingle()

  if (error) handleDbError(error)
  if (!data) return null
  const emb = data.uploader as unknown
  let uploaderName = '—'
  if (emb && typeof emb === 'object') {
    if (Array.isArray(emb)) {
      const u = emb[0] as { name?: string | null } | undefined
      uploaderName = u?.name?.trim() || '—'
    } else {
      uploaderName =
        ((emb as { name?: string | null }).name)?.trim() || '—'
    }
  }
  return {
    id: data.id as string,
    project_id: data.project_id as string,
    file_name: data.file_name as string,
    file_size: data.file_size as number,
    file_ext: (data.file_ext as string | null) ?? null,
    mime_type: (data.mime_type as string | null) ?? null,
    source_storage_key: data.source_storage_key as string,
    preview_storage_key: (data.preview_storage_key as string | null) ?? null,
    preview_status: (data.preview_status as string | null) ?? null,
    is_confidential: data.is_confidential === true,
    uploader_id: data.uploader_id as string,
    uploader_name: uploaderName,
  }
}

/** 当前用户是否为该项目成员（未删除） */
export async function isUserProjectMember(
  userId: string,
  projectId: string
): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('project_members')
    .select('id')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) handleDbError(error)
  return !!data
}

/** 取 parse 任务成功时的 result_data（如 Excel 预览 JSON） */
export async function getLatestParseResultData(
  fileId: string
): Promise<Json | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('file_process_tasks')
    .select('result_data')
    .eq('file_id', fileId)
    .eq('task_type', 'parse')
    .eq('status', 'success')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) handleDbError(error)
  return (data?.result_data as Json | null) ?? null
}
