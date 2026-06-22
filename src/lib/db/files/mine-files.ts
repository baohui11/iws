import { createAdminClient } from '@/lib/supabase/admin'
import { handleDbError } from '@/lib/db/handle-db-error'

export type FilesMineTab = 'uploads' | 'favorites' | 'recommends'

/** 我的文件列表每页条数（与滚动加载一致） */
export const MINE_FILES_PAGE_SIZE = 20

export interface MineFileRow {
  file_id: string
  file_name: string
  project_name: string | null
  /** 列表排序用：上传取文件创建时间；收藏/推荐取互动时间 */
  sort_at: string
}

export interface MineFilesPageResult {
  rows: MineFileRow[]
  hasMore: boolean
}

const MAX_INTERACTION_SCAN = 8000

/** 模糊匹配文件名（不区分大小写，子串即命中） */
export function fileNameMatchesQuery(fileName: string, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return fileName.toLowerCase().includes(q)
}

/** 供 PostgREST ilike 使用，避免用户输入中的 % _ \ 被当作通配符 */
function escapeForILike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function mapFileRow(
  r: Record<string, unknown>
): Pick<MineFileRow, 'file_id' | 'file_name' | 'project_name'> {
  const pj = r.projects as unknown as { project_name: string | null } | null
  return {
    file_id: r.id as string,
    file_name: (r.file_name as string) ?? '—',
    project_name: pj?.project_name ?? null,
  }
}

async function getMineUploadsPage(
  userId: string,
  offset: number,
  limit: number,
  fileNameQuery?: string | null
): Promise<MineFilesPageResult> {
  const supabase = createAdminClient()
  const safeLimit = Math.min(Math.max(1, limit), 100)
  const safeOffset = Math.max(0, offset)
  const q = fileNameQuery?.trim() ?? ''

  let qFiles = supabase
    .from('files')
    .select('id, file_name, created_at, project_id, projects(project_name)')
    .eq('uploader_id', userId)
    .eq('is_latest', true)
    .order('created_at', { ascending: false })

  if (q) {
    qFiles = qFiles.ilike('file_name', `%${escapeForILike(q)}%`)
  }

  const { data, error } = await qFiles.range(safeOffset, safeOffset + safeLimit)

  if (error) handleDbError(error)

  const raw = data ?? []
  const hasMore = raw.length > safeLimit
  const slice = hasMore ? raw.slice(0, safeLimit) : raw

  const rows: MineFileRow[] = slice.map((r) => {
    const m = mapFileRow(r as Record<string, unknown>)
    return {
      ...m,
      sort_at: r.created_at != null ? String(r.created_at) : '',
    }
  })

  return { rows, hasMore }
}

type FileMeta = Pick<MineFileRow, 'file_id' | 'file_name' | 'project_name'>

const FILE_IDS_CHUNK = 120

async function fetchFilesByIds(
  supabase: ReturnType<typeof createAdminClient>,
  fileIds: string[]
): Promise<Map<string, FileMeta>> {
  const out = new Map<string, FileMeta>()
  for (let i = 0; i < fileIds.length; i += FILE_IDS_CHUNK) {
    const chunk = fileIds.slice(i, i + FILE_IDS_CHUNK)
    const { data: files, error: fErr } = await supabase
      .from('files')
      .select('id, file_name, project_id, projects(project_name)')
      .in('id', chunk)
      .eq('is_latest', true)

    if (fErr) handleDbError(fErr)
    for (const f of files ?? []) {
      out.set(
        f.id as string,
        mapFileRow(f as unknown as Record<string, unknown>)
      )
    }
  }
  return out
}

/** 扫描互动记录，得到去重后的 file_id + sort_at 列表（时间倒序） */
async function collectUniqueInteractionOrder(
  userId: string,
  interactionType: 'favorite' | 'recommend',
  stopWhenUniqueCount?: number
): Promise<{ file_id: string; sort_at: string }[]> {
  const supabase = createAdminClient()
  const seen = new Set<string>()
  const uniqueOrdered: { file_id: string; sort_at: string }[] = []
  let rangeStart = 0
  const batch = 200
  let exhausted = false

  while (!exhausted) {
    if (rangeStart >= MAX_INTERACTION_SCAN) break

    const { data: fiRows, error: fiErr } = await supabase
      .from('file_interactions')
      .select('file_id, created_at')
      .eq('user_id', userId)
      .eq('interaction_type', interactionType)
      .order('created_at', { ascending: false })
      .range(rangeStart, rangeStart + batch - 1)

    if (fiErr) handleDbError(fiErr)
    if (!fiRows?.length) {
      exhausted = true
      break
    }
    if (fiRows.length < batch) exhausted = true

    for (const row of fiRows) {
      const fid = row.file_id as string
      if (!fid || seen.has(fid)) continue
      seen.add(fid)
      uniqueOrdered.push({
        file_id: fid,
        sort_at: row.created_at != null ? String(row.created_at) : '',
      })
      if (
        stopWhenUniqueCount !== undefined &&
        uniqueOrdered.length >= stopWhenUniqueCount
      ) {
        return uniqueOrdered
      }
    }
    if (
      stopWhenUniqueCount !== undefined &&
      uniqueOrdered.length >= stopWhenUniqueCount
    ) {
      break
    }
    rangeStart += batch
  }

  return uniqueOrdered
}

async function getMineInteractionFilesPage(
  userId: string,
  interactionType: 'favorite' | 'recommend',
  offset: number,
  limit: number,
  fileNameQuery?: string | null
): Promise<MineFilesPageResult> {
  const supabase = createAdminClient()
  const safeLimit = Math.min(Math.max(1, limit), 100)
  const safeOffset = Math.max(0, offset)
  const q = fileNameQuery?.trim() ?? ''

  if (!q) {
    const needUnique = safeOffset + safeLimit + 1
    const uniqueOrdered = await collectUniqueInteractionOrder(
      userId,
      interactionType,
      needUnique
    )

    const slice = uniqueOrdered.slice(safeOffset, safeOffset + safeLimit)
    const hasMore = uniqueOrdered.length > safeOffset + safeLimit

    if (!slice.length) return { rows: [], hasMore: false }

    const fileMap = await fetchFilesByIds(
      supabase,
      slice.map((s) => s.file_id)
    )

    const rows: MineFileRow[] = slice.map((s) => {
      const meta = fileMap.get(s.file_id)
      return {
        file_id: s.file_id,
        file_name: meta?.file_name ?? '—',
        project_name: meta?.project_name ?? null,
        sort_at: s.sort_at,
      }
    })

    return { rows, hasMore }
  }

  const uniqueOrdered = await collectUniqueInteractionOrder(
    userId,
    interactionType,
    undefined
  )

  const fileMap = await fetchFilesByIds(
    supabase,
    uniqueOrdered.map((s) => s.file_id)
  )

  const allRows: MineFileRow[] = uniqueOrdered.map((s) => {
    const meta = fileMap.get(s.file_id)
    return {
      file_id: s.file_id,
      file_name: meta?.file_name ?? '—',
      project_name: meta?.project_name ?? null,
      sort_at: s.sort_at,
    }
  })

  const filtered = allRows.filter((r) => fileNameMatchesQuery(r.file_name, q))
  const slice = filtered.slice(safeOffset, safeOffset + safeLimit + 1)
  const hasMore = slice.length > safeLimit
  const rows = hasMore ? slice.slice(0, safeLimit) : slice

  return { rows, hasMore }
}

/**
 * 分页：上传按创建时间；收藏/推荐按「首次出现的互动时间」去重后排序（与原先全量列表语义一致）。
 */
export async function getMyFilesMinePage(
  userId: string,
  tab: FilesMineTab,
  offset: number,
  limit: number,
  fileNameQuery?: string | null
): Promise<MineFilesPageResult> {
  if (tab === 'uploads') {
    return getMineUploadsPage(userId, offset, limit, fileNameQuery)
  }
  const interactionType = tab === 'favorites' ? 'favorite' : 'recommend'
  return getMineInteractionFilesPage(
    userId,
    interactionType,
    offset,
    limit,
    fileNameQuery
  )
}
