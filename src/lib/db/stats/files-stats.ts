import { createAdminClient } from '@/lib/supabase/admin'
import { getDepartmentIdsForListFilter } from '@/lib/db/admin/departments'
import { handleDbError } from '@/lib/db/handle-db-error'
import {
  flattenDepartmentTree,
  formatDepartmentPathLabel,
} from '@/lib/utils/department-display'
import type { DepartmentNode } from '@/lib/db/admin/departments'
import type { FileStatsPaged, FileStatsRow } from '@/types/stats'

async function projectIdsInDepartmentSubtree(departmentId: string): Promise<string[]> {
  const supabase = createAdminClient()
  const deptIds = await getDepartmentIdsForListFilter(departmentId)
  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .in('department_id', deptIds)
    .is('deleted_at', null)

  if (error) handleDbError(error)
  return (data ?? []).map((r) => r.id as string)
}

export interface ListFilesStatsParams {
  role: 'admin' | 'user' | 'dept_ld' | 'dept_admin' | null
  /** admin 未选部门时为 null，表示不限项目 */
  departmentId: string | null
  fileNameKeyword?: string | null
  projectKeyword?: string | null
  offset: number
  limit: number
}

export async function listFilesStatsPage(
  params: ListFilesStatsParams
): Promise<FileStatsPaged> {
  const supabase = createAdminClient()
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
    let pq = supabase
      .from('projects')
      .select('id')
      .is('deleted_at', null)
      .or(`project_name.ilike.%${pk}%,project_no.ilike.%${pk}%`)
    if (baseProjectIds) {
      pq = pq.in('id', baseProjectIds)
    }
    const { data: mp, error: mpErr } = await pq
    if (mpErr) handleDbError(mpErr)
    const mids = (mp ?? []).map((r) => r.id as string)
    if (!mids.length) {
      return { rows: [], total: 0, hasMore: false }
    }
    scopedIds = mids
  }

  let fq = supabase
    .from('files')
    .select(
      'id, file_name, file_size, file_ext, created_at, uploader_id, project_id, is_deliverable, is_confidential, file_source',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + safeLimit - 1)

  if (scopedIds) {
    fq = fq.in('project_id', scopedIds)
  }

  const fk = params.fileNameKeyword?.trim()
  if (fk) {
    fq = fq.ilike('file_name', `%${fk}%`)
  }

  const { data: fileRows, error: fErr, count } = await fq
  if (fErr) handleDbError(fErr)

  const rows = (fileRows ?? []) as {
    id: string
    file_name: string
    file_size: number
    file_ext: string | null
    created_at: string
    uploader_id: string
    project_id: string | null
    is_deliverable: boolean | null
    is_confidential: boolean | null
    file_source: string | null
  }[]

  if (!rows.length) {
    return { rows: [], total: count ?? 0, hasMore: false }
  }

  const uids = [...new Set(rows.map((r) => r.uploader_id).filter(Boolean))]
  const pids = [...new Set(rows.map((r) => r.project_id).filter(Boolean))] as string[]

  const { data: users, error: uErr } = await supabase
    .from('users')
    .select('id, name')
    .in('id', uids)
  if (uErr) handleDbError(uErr)
  const userName = new Map((users ?? []).map((u) => [u.id, u.name?.trim() ?? null]))

  const { data: projs, error: pErr } = await supabase
    .from('projects')
    .select('id, project_no, project_name, department_id, department_name:departments(name)')
    .in('id', pids)
  if (pErr) handleDbError(pErr)

  type ProjRow = {
    id: string
    project_no: string | null
    project_name: string | null
    department_id: string | null
    department_name: { name: string } | null
  }

  const projMap = new Map(
    (projs ?? []).map((p) => {
      const row = p as unknown as ProjRow
      return [
        row.id,
        {
          project_no: row.project_no,
          project_name: row.project_name,
          department_label: row.department_name?.name?.trim() || '—',
        },
      ] as const
    })
  )

  const out: FileStatsRow[] = rows.map((r) => {
    const p = r.project_id ? projMap.get(r.project_id) : undefined
    return {
      id: r.id,
      file_name: r.file_name,
      file_size: Number(r.file_size),
      file_ext: r.file_ext,
      created_at: r.created_at != null ? String(r.created_at) : '',
      uploader_name: userName.get(r.uploader_id) ?? null,
      project_no: p?.project_no ?? null,
      project_name: p?.project_name ?? null,
      department_label: p?.department_label ?? '—',
      is_deliverable: Boolean(r.is_deliverable),
      is_confidential: Boolean(r.is_confidential),
      file_source: r.file_source,
    }
  })

  const total = count ?? 0
  const hasMore = offset + rows.length < total
  return { rows: out, total, hasMore }
}

/** 供下拉框：部门树拍平后按可访问范围过滤（与 assertDeptStatsAccess 一致由上层保证） */
export function formatDepartmentOptionsForStats(
  tree: DepartmentNode[],
  allowedIds: string[] | null
): { id: string; label: string }[] {
  const flat = flattenDepartmentTree(tree)
  const list = allowedIds
    ? flat.filter((n) => allowedIds.includes(n.id))
    : flat
  return list.map((n) => ({
    id: n.id,
    label: formatDepartmentPathLabel(n.id, flat, n.name),
  }))
}
