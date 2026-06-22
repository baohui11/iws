import { createClient } from '@/lib/supabase/server'
import { handleDbError } from '@/lib/db/handle-db-error'
import type { ListProjectFilesFilters, ProjectFileListRow } from '@/types/project-files'
import {
  PROJECT_FILE_ALL_KNOWN_EXTS,
  PROJECT_FILE_TYPE_CATEGORY_EXTS,
  type ProjectFileTypeCategory,
} from '@/lib/utils/project-file-type-category'

type ServerClient = Awaited<ReturnType<typeof createClient>>

type FileRowDb = {
  id: string
  file_name: string
  file_size: number
  file_ext: string | null
  mime_type: string | null
  source_storage_key: string
  created_at: string
  uploader_id: string
  is_confidential: boolean | null
  is_deliverable: boolean | null
  contract_deliverable_id: string | null
  file_source: string | null
  is_latest: boolean | null
}

async function mapRowsWithUploaderNames(
  supabase: ServerClient,
  rows: FileRowDb[]
): Promise<ProjectFileListRow[]> {
  if (!rows.length) return []
  const uids = [...new Set(rows.map((r) => r.uploader_id))]
  const { data: users, error } = await supabase
    .from('users')
    .select('id, name')
    .in('id', uids)
  if (error) handleDbError(error)
  const nameBy = new Map((users ?? []).map((u) => [u.id, u.name?.trim() ?? null]))

  return rows.map((r) => ({
    id: r.id,
    file_name: r.file_name,
    file_size: Number(r.file_size),
    file_ext: r.file_ext,
    mime_type: r.mime_type,
    source_storage_key: r.source_storage_key,
    created_at: r.created_at != null ? String(r.created_at) : '',
    uploader_name: nameBy.get(r.uploader_id) ?? null,
    is_confidential: Boolean(r.is_confidential),
    is_deliverable: Boolean(r.is_deliverable),
    contract_deliverable_id: r.contract_deliverable_id,
    file_source: r.file_source,
    is_latest: Boolean(r.is_latest),
  }))
}

const FILE_SELECT =
  'id, file_name, file_size, file_ext, mime_type, source_storage_key, created_at, uploader_id, is_confidential, is_deliverable, contract_deliverable_id, file_source, is_latest'

/** 分页列表：按 created_at 倒序 */
export async function listProjectFilesPage(
  projectId: string,
  filters: ListProjectFilesFilters,
  offset: number,
  limit: number
): Promise<{ rows: ProjectFileListRow[]; hasMore: boolean }> {
  const supabase = await createClient()
  const safeLimit = Math.min(Math.max(1, limit), 50)
  const safeOffset = Math.max(0, offset)

  let q = supabase
    .from('files')
    .select(FILE_SELECT)
    .eq('project_id', projectId)

  const { scope } = filters

  if (scope === 'deliverable') {
    q = q.eq('is_deliverable', true)
    if (filters.contractDeliverOnly) {
      q = q.not('contract_deliverable_id', 'is', null)
    }
    if (filters.latestOnly !== false) {
      q = q.eq('is_latest', true)
    }
  } else if (scope === 'reference') {
    q = q.eq('is_deliverable', false).eq('is_latest', true)
    const src = filters.referenceSource?.trim()
    if (src && src !== 'all') {
      q = q.eq('file_source', src)
    }
  }

  const typeCat: ProjectFileTypeCategory = filters.typeCategory ?? 'all'
  if (typeCat !== 'all') {
    if (typeCat === 'other') {
      const list = PROJECT_FILE_ALL_KNOWN_EXTS.join(',')
      q = q.or(`file_ext.is.null,file_ext.not.in.(${list})`)
    } else {
      const exts = [...PROJECT_FILE_TYPE_CATEGORY_EXTS[typeCat]]
      q = q.in('file_ext', exts)
    }
  }

  q = q
    .order('created_at', { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1)

  const { data, error } = await q
  if (error) handleDbError(error)

  const rows = await mapRowsWithUploaderNames(supabase, (data ?? []) as FileRowDb[])
  const hasMore = rows.length === safeLimit
  return { rows, hasMore }
}
