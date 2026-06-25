import { and, desc, eq, ilike, inArray } from 'drizzle-orm'
import { getDb } from '@/core/db/client'
import { fileInteractions, files, projects } from '@/core/db/schema'
import type {
  FilesMineTab,
  MineFileRow,
  MineFilesPageResult,
} from '../types'
import { MINE_FILES_PAGE_SIZE } from '../types'

export { MINE_FILES_PAGE_SIZE }

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
  r: {
    id: string
    file_name: string
    project_name: string | null
  }
): Pick<MineFileRow, 'file_id' | 'file_name' | 'project_name'> {
  return {
    file_id: r.id,
    file_name: r.file_name ?? '—',
    project_name: r.project_name ?? null,
  }
}

async function getMineUploadsPage(
  userId: string,
  offset: number,
  limit: number,
  fileNameQuery?: string | null
): Promise<MineFilesPageResult> {
  const db = getDb()
  const safeLimit = Math.min(Math.max(1, limit), 100)
  const safeOffset = Math.max(0, offset)
  const q = fileNameQuery?.trim() ?? ''

  const conditions = [
    eq(files.uploaderId, userId),
    eq(files.isLatest, true),
  ]
  if (q) {
    conditions.push(ilike(files.fileName, `%${escapeForILike(q)}%`))
  }

  const raw = await db
    .select({
      id: files.id,
      file_name: files.fileName,
      created_at: files.createdAt,
      project_name: projects.projectName,
    })
    .from(files)
    .leftJoin(projects, eq(files.projectId, projects.id))
    .where(and(...conditions))
    .orderBy(desc(files.createdAt))
    .offset(safeOffset)
    .limit(safeLimit + 1)

  const hasMore = raw.length > safeLimit
  const slice = hasMore ? raw.slice(0, safeLimit) : raw

  const rows: MineFileRow[] = slice.map((r) => {
    const m = mapFileRow({
      id: r.id,
      file_name: r.file_name,
      project_name: r.project_name,
    })
    return {
      ...m,
      sort_at: r.created_at != null ? toIsoString(r.created_at) : '',
    }
  })

  return { rows, hasMore }
}

type FileMeta = Pick<MineFileRow, 'file_id' | 'file_name' | 'project_name'>

const FILE_IDS_CHUNK = 120

function toIsoString(d: Date | string | null | undefined): string {
  if (d == null) return ''
  return d instanceof Date ? d.toISOString() : String(d)
}

async function fetchFilesByIds(fileIds: string[]): Promise<Map<string, FileMeta>> {
  const db = getDb()
  const out = new Map<string, FileMeta>()
  for (let i = 0; i < fileIds.length; i += FILE_IDS_CHUNK) {
    const chunk = fileIds.slice(i, i + FILE_IDS_CHUNK)
    const fileRows = await db
      .select({
        id: files.id,
        file_name: files.fileName,
        project_name: projects.projectName,
      })
      .from(files)
      .leftJoin(projects, eq(files.projectId, projects.id))
      .where(and(inArray(files.id, chunk), eq(files.isLatest, true)))

    for (const f of fileRows) {
      out.set(
        f.id,
        mapFileRow({
          id: f.id,
          file_name: f.file_name,
          project_name: f.project_name,
        })
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
  const db = getDb()
  const seen = new Set<string>()
  const uniqueOrdered: { file_id: string; sort_at: string }[] = []
  let rangeStart = 0
  const batch = 200
  let exhausted = false

  while (!exhausted) {
    if (rangeStart >= MAX_INTERACTION_SCAN) break

    const fiRows = await db
      .select({
        file_id: fileInteractions.fileId,
        created_at: fileInteractions.createdAt,
      })
      .from(fileInteractions)
      .where(
        and(
          eq(fileInteractions.userId, userId),
          eq(fileInteractions.interactionType, interactionType)
        )
      )
      .orderBy(desc(fileInteractions.createdAt))
      .offset(rangeStart)
      .limit(batch)

    if (!fiRows.length) {
      exhausted = true
      break
    }
    if (fiRows.length < batch) exhausted = true

    for (const row of fiRows) {
      const fid = row.file_id
      if (!fid || seen.has(fid)) continue
      seen.add(fid)
      uniqueOrdered.push({
        file_id: fid,
        sort_at: row.created_at != null ? toIsoString(row.created_at) : '',
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

    const fileMap = await fetchFilesByIds(slice.map((s) => s.file_id))

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

  const fileMap = await fetchFilesByIds(uniqueOrdered.map((s) => s.file_id))

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
