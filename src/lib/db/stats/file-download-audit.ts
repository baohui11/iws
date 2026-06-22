import { createAdminClient } from '@/lib/supabase/admin'
import { handleDbError } from '@/lib/db/handle-db-error'
import { ValidationError } from '@/lib/errors'

export interface FileDownloadByPersonRow {
  user_id: string | null
  user_name: string
  download_count: number
}

export interface FileDownloadDetailRow {
  id: string
  downloaded_at: string | null
  file_id: string | null
  file_name: string | null
  user_id: string | null
  user_name: string | null
  ip_address: string | null
}

export interface FileDownloadDetailsPaged {
  rows: FileDownloadDetailRow[]
  total: number
}

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

function escapeIlike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/**
 * 按人员汇总下载次数（service role 全量扫描日期范围内记录，内存聚合）。
 */
export async function getFileDownloadCountByPerson(params: {
  dateFrom: string
  dateTo: string
  nameKeyword: string | null
}): Promise<FileDownloadByPersonRow[]> {
  const supabase = createAdminClient()
  const { fromIso, toIso } = parseDownloadAuditDateRange(
    params.dateFrom,
    params.dateTo
  )
  const kw = params.nameKeyword?.trim().toLowerCase() ?? ''

  const counts = new Map<
    string | null,
    { name: string; count: number }
  >()

  let offset = 0
  for (;;) {
    const { data, error } = await supabase
      .from('file_download_record')
      .select('user_id, users(name)')
      .gte('downloaded_at', fromIso)
      .lte('downloaded_at', toIso)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_CHUNK - 1)

    if (error) handleDbError(error)
    const rows = data ?? []
    if (rows.length === 0) break

    for (const row of rows) {
      const uid = (row.user_id as string | null) ?? null
      const name =
        (row.users as unknown as { name: string | null } | null)?.name?.trim() ??
        null
      const displayName = name && name.length > 0 ? name : '（未关联用户）'
      if (kw) {
        const hay = (name ?? '（未关联用户）').toLowerCase()
        if (!hay.includes(kw)) continue
      }
      const key = uid
      const prev = counts.get(key)
      if (prev) {
        prev.count += 1
      } else {
        counts.set(key, { name: displayName, count: 1 })
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

/**
 * 下载明细分页（按下载时间倒序）。
 */
export async function listFileDownloadDetailsForAudit(params: {
  dateFrom: string
  dateTo: string
  nameKeyword: string | null
  offset: number
  limit: number
}): Promise<FileDownloadDetailsPaged> {
  const supabase = createAdminClient()
  const { fromIso, toIso } = parseDownloadAuditDateRange(
    params.dateFrom,
    params.dateTo
  )
  const safeLimit = Math.min(Math.max(1, params.limit), 200)
  const safeOffset = Math.max(0, params.offset)
  const kw = params.nameKeyword?.trim()

  let userIdFilter: string[] | null = null
  if (kw) {
    const { data: matchUsers, error: uErr } = await supabase
      .from('users')
      .select('id')
      .is('deleted_at', null)
      .ilike('name', `%${escapeIlike(kw)}%`)

    if (uErr) handleDbError(uErr)
    userIdFilter = (matchUsers ?? [])
      .map((r) => r.id as string)
      .filter(Boolean)
    if (userIdFilter.length === 0) {
      return { rows: [], total: 0 }
    }
  }

  let countQuery = supabase
    .from('file_download_record')
    .select('*', { count: 'exact', head: true })
    .gte('downloaded_at', fromIso)
    .lte('downloaded_at', toIso)

  let dataQuery = supabase
    .from('file_download_record')
    .select(
      `
      id,
      downloaded_at,
      file_id,
      ip_address,
      user_id,
      users!file_download_record_user_id_fkey(name),
      files!file_download_record_file_id_fkey(file_name)
    `
    )
    .gte('downloaded_at', fromIso)
    .lte('downloaded_at', toIso)
    .order('downloaded_at', { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1)

  if (userIdFilter) {
    countQuery = countQuery.in('user_id', userIdFilter)
    dataQuery = dataQuery.in('user_id', userIdFilter)
  }

  const { count, error: cErr } = await countQuery
  if (cErr) handleDbError(cErr)

  const { data, error: dErr } = await dataQuery
  if (dErr) handleDbError(dErr)

  const rows: FileDownloadDetailRow[] = (data ?? []).map((r) => {
    const u = r.users as unknown as { name: string | null } | null
    const f = r.files as unknown as { file_name: string | null } | null
    return {
      id: r.id as string,
      downloaded_at: r.downloaded_at != null ? String(r.downloaded_at) : null,
      file_id: (r.file_id as string | null) ?? null,
      file_name: f?.file_name ?? null,
      user_id: (r.user_id as string | null) ?? null,
      user_name: u?.name?.trim() || null,
      ip_address: (r.ip_address as string | null) ?? null,
    }
  })

  return { rows, total: count ?? 0 }
}
