import { and, desc, eq, ilike } from 'drizzle-orm'
import { getDb } from '@/core/db/client'
import { files, projects } from '@/core/db/schema'
import type { ProjectStageValue } from '@/constants/project-stage'
import type { MineFileRow, MineFilesPageResult } from '../types'
import { MINE_FILES_PAGE_SIZE } from '../types'

export { MINE_FILES_PAGE_SIZE }

/** 供 PostgREST ilike 使用，避免用户输入中的 % _ \ 被当作通配符 */
function escapeForILike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function toIsoString(d: Date | string | null | undefined): string {
  if (d == null) return ''
  return d instanceof Date ? d.toISOString() : String(d)
}

export interface MyUploadedFilesParams {
  userId: string
  offset: number
  limit: number
  fileNameQuery?: string | null
  projectId?: string | null
  projectStage?: ProjectStageValue | null
}

export async function getMyUploadedFilesPage({
  userId,
  offset,
  limit,
  fileNameQuery,
  projectId,
  projectStage,
}: MyUploadedFilesParams): Promise<MineFilesPageResult> {
  const db = getDb()
  const safeLimit = Math.min(Math.max(1, limit), 100)
  const safeOffset = Math.max(0, offset)
  const q = fileNameQuery?.trim() ?? ''

  const conditions = [
    eq(files.uploaderId, userId),
    eq(files.isLatest, true),
  ]
  const pid = projectId?.trim()
  if (pid) {
    conditions.push(eq(files.projectId, pid))
  }
  if (projectStage) {
    conditions.push(eq(files.projectStage, projectStage))
  }
  if (q) {
    conditions.push(ilike(files.fileName, `%${escapeForILike(q)}%`))
  }

  const raw = await db
    .select({
      id: files.id,
      file_name: files.fileName,
      created_at: files.createdAt,
      project_id: files.projectId,
      project_name: projects.projectName,
      project_stage: files.projectStage,
      is_deliverable: files.isDeliverable,
      file_source: files.fileSource,
      sales_file_tag: files.salesFileTag,
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
    return {
      file_id: r.id,
      file_name: r.file_name ?? '-',
      project_id: r.project_id,
      project_name: r.project_name ?? null,
      project_stage: r.project_stage,
      is_deliverable: r.is_deliverable ?? false,
      file_source: r.file_source,
      sales_file_tag: r.sales_file_tag,
      sort_at: r.created_at != null ? toIsoString(r.created_at) : '',
    }
  })

  return { rows, hasMore }
}

export async function listMyUploadedFileProjects(
  userId: string
): Promise<
  {
    id: string
    project_no: string | null
    project_name: string | null
  }[]
> {
  const db = getDb()
  const rows = await db
    .select({
      id: projects.id,
      project_no: projects.projectNo,
      project_name: projects.projectName,
    })
    .from(files)
    .innerJoin(projects, eq(files.projectId, projects.id))
    .where(and(eq(files.uploaderId, userId), eq(files.isLatest, true)))
    .groupBy(projects.id, projects.projectNo, projects.projectName)
    .orderBy(projects.projectNo)

  return rows
}
