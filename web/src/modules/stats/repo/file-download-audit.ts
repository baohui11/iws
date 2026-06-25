import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, sql } from 'drizzle-orm'
import { getDb } from '@/core/db/client'
import { fileDownloadRecord, files, users } from '@/core/db/schema'
import { ValidationError } from '@/core/errors'
import type {
  FileDownloadByPersonRow,
  FileDownloadDetailRow,
  FileDownloadDetailsPaged,
} from '../types'

const PAGE_CHUNK = 1000

function assertDateYmd(s: string): string {
  const t = s?.trim()
  if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    throw new ValidationError('请使用有效日期（YYYY-MM-DD）')
  }
  const d = new Date(t + 'T12:00:00')
  if (Number.isNaN(d.getTime())) throw new ValidationError('日期无效')
  return t
}

export function parseDownloadAuditDateRange(
  dateFrom: string,
  dateTo: string
): { fromIso: string; toIso: string } {
  const a = assertDateYmd(dateFrom)
  const b = assertDateYmd(dateTo)
  const from = new Date(a + 'T00:00:00')
  const to = new Date(b + 'T23:59:59.999')
  if (from > to) {
    throw new ValidationError('开始日期不能晚于结束日期')
  }
  return { fromIso: from.toISOString(), toIso: to.toISOString() }
}

function escapeForILike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export async function getFileDownloadCountByPerson(params: {
  dateFrom: string
  dateTo: string
  nameKeyword: string | null
}): Promise<FileDownloadByPersonRow[]> {
  const db = getDb()
  const { fromIso, toIso } = parseDownloadAuditDateRange(params.dateFrom, params.dateTo)
  const kw = params.nameKeyword?.trim().toLowerCase() ?? ''

  const counts = new Map<string | null, { name: string; count: number }>()

  let offset = 0
  for (;;) {
    const rows = await db
      .select({
        userId: fileDownloadRecord.userId,
        userName: users.name,
      })
      .from(fileDownloadRecord)
      .leftJoin(users, eq(fileDownloadRecord.userId, users.id))
      .where(
        and(
          gte(fileDownloadRecord.downloadedAt, new Date(fromIso)),
          lte(fileDownloadRecord.downloadedAt, new Date(toIso))
        )
      )
      .orderBy(asc(fileDownloadRecord.id))
      .offset(offset)
      .limit(PAGE_CHUNK)

    if (rows.length === 0) break

    for (const row of rows) {
      const uid = row.userId ?? null
      const name = row.userName?.trim() ?? null
      const displayName = name && name.length > 0 ? name : '（未关联用户）'
      if (kw) {
        const hay = (name ?? '（未关联用户）').toLowerCase()
        if (!hay.includes(kw)) continue
      }
      const prev = counts.get(uid)
      if (prev) {
        prev.count += 1
      } else {
        counts.set(uid, { name: displayName, count: 1 })
      }
    }

    offset += PAGE_CHUNK
    if (rows.length < PAGE_CHUNK) break
  }

  const out: FileDownloadByPersonRow[] = []
  for (const [userId, v] of counts) {
    out.push({
      user_id: userId,
      user_name: v.name,
      download_count: v.count,
    })
  }
  out.sort((a, b) => b.download_count - a.download_count)
  return out
}

export async function listFileDownloadDetailsForAudit(params: {
  dateFrom: string
  dateTo: string
  nameKeyword: string | null
  offset: number
  limit: number
}): Promise<FileDownloadDetailsPaged> {
  const db = getDb()
  const { fromIso, toIso } = parseDownloadAuditDateRange(params.dateFrom, params.dateTo)
  const safeLimit = Math.min(Math.max(1, params.limit), 200)
  const safeOffset = Math.max(0, params.offset)
  const kw = params.nameKeyword?.trim()

  let userIdFilter: string[] | null = null
  if (kw) {
    const matchUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(and(isNull(users.deletedAt), ilike(users.name, `%${escapeForILike(kw)}%`)))
    userIdFilter = matchUsers.map((r) => r.id).filter(Boolean)
    if (userIdFilter.length === 0) {
      return { rows: [], total: 0 }
    }
  }

  const dateCondition = and(
    gte(fileDownloadRecord.downloadedAt, new Date(fromIso)),
    lte(fileDownloadRecord.downloadedAt, new Date(toIso))
  )
  const whereClause = userIdFilter
    ? and(dateCondition, inArray(fileDownloadRecord.userId, userIdFilter))
    : dateCondition

  const [countRow] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(fileDownloadRecord)
    .where(whereClause)

  const dataRows = await db
    .select({
      id: fileDownloadRecord.id,
      downloadedAt: fileDownloadRecord.downloadedAt,
      fileId: fileDownloadRecord.fileId,
      ipAddress: fileDownloadRecord.ipAddress,
      userId: fileDownloadRecord.userId,
      userName: users.name,
      fileName: files.fileName,
    })
    .from(fileDownloadRecord)
    .leftJoin(users, eq(fileDownloadRecord.userId, users.id))
    .leftJoin(files, eq(fileDownloadRecord.fileId, files.id))
    .where(whereClause)
    .orderBy(desc(fileDownloadRecord.downloadedAt))
    .offset(safeOffset)
    .limit(safeLimit)

  const rows: FileDownloadDetailRow[] = dataRows.map((r) => ({
    id: r.id,
    downloaded_at: r.downloadedAt != null ? String(r.downloadedAt) : null,
    file_id: r.fileId ?? null,
    file_name: r.fileName ?? null,
    user_id: r.userId ?? null,
    user_name: r.userName?.trim() || null,
    ip_address: r.ipAddress ?? null,
  }))

  return { rows, total: countRow?.value ?? 0 }
}
