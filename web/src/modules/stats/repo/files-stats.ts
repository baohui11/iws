import { and, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'
import { getDb } from '@/core/db/client'
import { departments, files, projects, users } from '@/core/db/schema'
import { getDepartmentIdsForListFilter } from '@/modules/org/departments/repo'
import type { SystemRole } from '@/core/auth/current-user'
import type { FileStatsPaged, FileStatsRow } from '../types'

function escapeForILike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

async function projectIdsInDepartmentSubtree(departmentId: string): Promise<string[]> {
  const db = getDb()
  const deptIds = await getDepartmentIdsForListFilter(departmentId)
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(inArray(projects.departmentId, deptIds), isNull(projects.deletedAt)))

  return rows.map((r) => r.id)
}

export interface ListFilesStatsParams {
  role: SystemRole | null
  departmentId: string | null
  fileNameKeyword?: string | null
  projectKeyword?: string | null
  offset: number
  limit: number
}

export async function listFilesStatsPage(
  params: ListFilesStatsParams
): Promise<FileStatsPaged> {
  const db = getDb()
  const safeLimit = Math.min(Math.max(1, params.limit), 100)
  const offset = Math.max(0, params.offset)

  let baseProjectIds: string[] | null = null
  if (params.role === 'admin' && !params.departmentId?.trim()) {
    baseProjectIds = null
  } else {
    const did = params.departmentId?.trim()
    if (!did) {
      return { rows: [], total: 0, hasMore: false }
    }
    const ids = await projectIdsInDepartmentSubtree(did)
    if (!ids.length) {
      return { rows: [], total: 0, hasMore: false }
    }
    baseProjectIds = ids
  }

  let scopedIds: string[] | null = baseProjectIds
  const pk = params.projectKeyword?.trim()
  if (pk) {
    const k = `%${escapeForILike(pk)}%`
    const conditions = [
      isNull(projects.deletedAt),
      or(ilike(projects.projectName, k), ilike(projects.projectNo, k)),
    ]
    if (baseProjectIds) {
      conditions.push(inArray(projects.id, baseProjectIds))
    }
    const matchRows = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(...conditions))
    const mids = matchRows.map((r) => r.id)
    if (!mids.length) {
      return { rows: [], total: 0, hasMore: false }
    }
    scopedIds = mids
  }

  const conditions = []
  if (scopedIds) {
    conditions.push(inArray(files.projectId, scopedIds))
  }
  const fk = params.fileNameKeyword?.trim()
  if (fk) {
    conditions.push(ilike(files.fileName, `%${escapeForILike(fk)}%`))
  }

  const whereClause = conditions.length ? and(...conditions) : undefined

  const [countRow] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(files)
    .where(whereClause)

  const total = countRow?.value ?? 0

  const fileRows = await db
    .select({
      id: files.id,
      fileName: files.fileName,
      fileSize: files.fileSize,
      fileExt: files.fileExt,
      createdAt: files.createdAt,
      uploaderId: files.uploaderId,
      projectId: files.projectId,
      isDeliverable: files.isDeliverable,
      isConfidential: files.isConfidential,
      fileSource: files.fileSource,
    })
    .from(files)
    .where(whereClause)
    .orderBy(desc(files.createdAt))
    .offset(offset)
    .limit(safeLimit)

  if (!fileRows.length) {
    return { rows: [], total, hasMore: false }
  }

  const uids = [...new Set(fileRows.map((r) => r.uploaderId).filter(Boolean))]
  const pids = [...new Set(fileRows.map((r) => r.projectId).filter(Boolean))]

  const userRows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(inArray(users.id, uids))
  const userName = new Map(userRows.map((u) => [u.id, u.name?.trim() ?? null]))

  const projRows = await db
    .select({
      id: projects.id,
      projectNo: projects.projectNo,
      projectName: projects.projectName,
      departmentName: departments.name,
    })
    .from(projects)
    .leftJoin(departments, eq(projects.departmentId, departments.id))
    .where(inArray(projects.id, pids))

  const projMap = new Map(
    projRows.map((p) => [
      p.id,
      {
        project_no: p.projectNo,
        project_name: p.projectName,
        department_label: p.departmentName?.trim() || '—',
      },
    ])
  )

  const out: FileStatsRow[] = fileRows.map((r) => {
    const p = r.projectId ? projMap.get(r.projectId) : undefined
    return {
      id: r.id,
      file_name: r.fileName,
      file_size: Number(r.fileSize),
      file_ext: r.fileExt,
      created_at: r.createdAt != null ? String(r.createdAt) : '',
      uploader_name: userName.get(r.uploaderId) ?? null,
      project_no: p?.project_no ?? null,
      project_name: p?.project_name ?? null,
      department_label: p?.department_label ?? '—',
      is_deliverable: Boolean(r.isDeliverable),
      is_confidential: Boolean(r.isConfidential),
      file_source: r.fileSource,
    }
  })

  const hasMore = offset + fileRows.length < total
  return { rows: out, total, hasMore }
}
