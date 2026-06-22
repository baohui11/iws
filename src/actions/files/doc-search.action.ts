'use server'

import { handleAction } from '@/lib/action-handler'
import { AuthError, ValidationError } from '@/lib/errors'
import { postDocSearch } from '@/lib/doc-search/search-api'
import { getProfileById } from '@/lib/db/auth/profile'
import type { DocSearchFilterKey, DocSearchFilters } from '@/types/doc-search'

const FILTER_KEYS = new Set<DocSearchFilterKey>([
  'department_id',
  'project_id',
  'uploader_id',
  'department_name',
  'project_name',
  'file_name',
  'file_type',
  'file_ext',
  'content_degraded',
])

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function assertUuid(field: string, value: string) {
  if (!UUID_RE.test(value)) {
    throw new ValidationError(`${field} 不是有效 UUID`)
  }
}

async function requireProfile() {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new AuthError('请先登录')
  const profile = await getProfileById(user.id)
  if (!profile) throw new AuthError('请先登录')
  return profile
}

function normalizeFilters(raw: Record<string, unknown> | null | undefined): DocSearchFilters {
  if (!raw || typeof raw !== 'object') return {}
  const out: DocSearchFilters = {}
  for (const [k, v] of Object.entries(raw)) {
    if (!FILTER_KEYS.has(k as DocSearchFilterKey)) {
      throw new ValidationError(`非法筛选项：${k}`)
    }
    if (v === null || v === undefined || v === '') continue
    if (k === 'content_degraded') {
      if (typeof v === 'boolean') {
        out.content_degraded = v
      } else if (v === 'true' || v === 'false') {
        out.content_degraded = v === 'true'
      } else {
        throw new ValidationError('content_degraded 须为 true / false')
      }
      continue
    }
    if (typeof v !== 'string') {
      throw new ValidationError(`筛选项 ${k} 须为字符串`)
    }
    const s = v.trim()
    if (!s) continue
    if (k === 'department_id' || k === 'project_id' || k === 'uploader_id') {
      assertUuid(k, s)
    }
    ;(out as Record<string, string>)[k] = s
  }
  return out
}

export async function searchDocumentsAction(input: {
  q?: string
  limit?: number
  offset?: number
  filters?: Record<string, unknown>
  crop_length?: number
  max_content_chars?: number
}) {
  return handleAction(async () => {
    await requireProfile()

    const limit = Math.min(
      200,
      Math.max(1, Number(input.limit) || 20)
    )
    const offset = Math.max(0, Math.floor(Number(input.offset) || 0))
    const q = typeof input.q === 'string' ? input.q : ''
    const filters = normalizeFilters(input.filters)

    const body: Parameters<typeof postDocSearch>[0] = {
      q,
      limit,
      offset,
      ...(Object.keys(filters).length > 0 ? { filters } : {}),
    }
    if (input.crop_length != null && Number.isFinite(input.crop_length)) {
      body.crop_length = Math.max(0, Math.floor(Number(input.crop_length)))
    }
    if (
      input.max_content_chars != null &&
      Number.isFinite(input.max_content_chars)
    ) {
      body.max_content_chars = Math.max(
        0,
        Math.floor(Number(input.max_content_chars))
      )
    }

    return postDocSearch(body)
  })
}
