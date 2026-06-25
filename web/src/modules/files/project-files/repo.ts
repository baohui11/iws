import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  not,
  or,
} from 'drizzle-orm'
import { getDb } from '@/core/db/client'
import { files, users } from '@/core/db/schema'
import {
  PROJECT_FILE_ALL_KNOWN_EXTS,
  PROJECT_FILE_TYPE_CATEGORY_EXTS,
  type ProjectFileTypeCategory,
} from '@/modules/files/lib/project-file-type-category'
import type { ListProjectFilesFilters, ProjectFileListRow, FileSourceValue } from '../types'

type FileRowDb = {
  id: string
  file_name: string
  file_size: number
  file_ext: string | null
  mime_type: string | null
  source_storage_key: string
  created_at: Date | string | null
  uploader_id: string
  is_confidential: boolean | null
  is_deliverable: boolean | null
  contract_deliverable_id: string | null
  file_source: string | null
  is_latest: boolean | null
}

function toIsoString(d: Date | string | null | undefined): string {
  if (d == null) return ''
  return d instanceof Date ? d.toISOString() : String(d)
}

async function mapRowsWithUploaderNames(
  rows: FileRowDb[]
): Promise<ProjectFileListRow[]> {
  if (!rows.length) return []
  const uids = [...new Set(rows.map((r) => r.uploader_id))]
  const db = getDb()
  const userRows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(inArray(users.id, uids))

  const nameBy = new Map(
    userRows.map((u) => [u.id, u.name?.trim() ?? null])
  )

  return rows.map((r) => ({
    id: r.id,
    file_name: r.file_name,
    file_size: Number(r.file_size),
    file_ext: r.file_ext,
    mime_type: r.mime_type,
    source_storage_key: r.source_storage_key,
    created_at: toIsoString(r.created_at),
    uploader_name: nameBy.get(r.uploader_id) ?? null,
    is_confidential: Boolean(r.is_confidential),
    is_deliverable: Boolean(r.is_deliverable),
    contract_deliverable_id: r.contract_deliverable_id,
    file_source: r.file_source,
    is_latest: Boolean(r.is_latest),
  }))
}

/** 分页列表：按 created_at 倒序 */
export async function listProjectFilesPage(
  projectId: string,
  filters: ListProjectFilesFilters,
  offset: number,
  limit: number
): Promise<{ rows: ProjectFileListRow[]; hasMore: boolean }> {
  const db = getDb()
  const safeLimit = Math.min(Math.max(1, limit), 50)
  const safeOffset = Math.max(0, offset)

  const conditions = [eq(files.projectId, projectId)]

  const { scope } = filters

  if (scope === 'deliverable') {
    conditions.push(eq(files.isDeliverable, true))
    if (filters.contractDeliverOnly) {
      conditions.push(isNotNull(files.contractDeliverableId))
    }
    if (filters.latestOnly !== false) {
      conditions.push(eq(files.isLatest, true))
    }
  } else if (scope === 'reference') {
    conditions.push(eq(files.isDeliverable, false))
    conditions.push(eq(files.isLatest, true))
    const src = filters.referenceSource?.trim()
    if (src && src !== 'all') {
      conditions.push(
        eq(files.fileSource, src as FileSourceValue)
      )
    }
  }

  const typeCat: ProjectFileTypeCategory = filters.typeCategory ?? 'all'
  if (typeCat !== 'all') {
    if (typeCat === 'other') {
      const list = PROJECT_FILE_ALL_KNOWN_EXTS
      conditions.push(
        or(isNull(files.fileExt), not(inArray(files.fileExt, list)))!
      )
    } else {
      const exts = [...PROJECT_FILE_TYPE_CATEGORY_EXTS[typeCat]]
      conditions.push(inArray(files.fileExt, exts))
    }
  }

  const data = await db
    .select({
      id: files.id,
      file_name: files.fileName,
      file_size: files.fileSize,
      file_ext: files.fileExt,
      mime_type: files.mimeType,
      source_storage_key: files.sourceStorageKey,
      created_at: files.createdAt,
      uploader_id: files.uploaderId,
      is_confidential: files.isConfidential,
      is_deliverable: files.isDeliverable,
      contract_deliverable_id: files.contractDeliverableId,
      file_source: files.fileSource,
      is_latest: files.isLatest,
    })
    .from(files)
    .where(and(...conditions))
    .orderBy(desc(files.createdAt))
    .offset(safeOffset)
    .limit(safeLimit)

  const rows = await mapRowsWithUploaderNames(data as FileRowDb[])
  const hasMore = rows.length === safeLimit
  return { rows, hasMore }
}
