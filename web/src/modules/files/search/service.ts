import { requireUser } from '@/core/auth'
import { getDb } from '@/core/db/client'
import { ValidationError } from '@/core/errors'
import { sql } from 'drizzle-orm'
import { embedQueryText } from '@/core/adapters/embedding/internal-embedding'
import {
  buildCanAccessContentSql,
  buildVisibleFileSql,
  getFileDepartmentScopeIds,
} from '@/modules/files/access'
import type {
  DocSearchFilterKey,
  DocSearchFilters,
  DocSearchMode,
} from '../types'

const FULLTEXT_CONFIG = 'jiebacfg'
const QUERY_CONFIG = 'jiebaqry'
const MAX_SNIPPETS_PER_FILE = 3
// Candidate recall is deliberately bounded.  Ranking every visible file makes
// both the GIN and pgvector indexes ineffective as the corpus grows.
const CANDIDATE_POOL_SIZE = 300
const RRF_K = 60

const FILTER_KEYS = new Set<DocSearchFilterKey>([
  'department_id',
  'project_id',
  'uploader_id',
  'project_stage',
  'department_name',
  'project_name',
  'file_name',
  'file_type',
  'file_ext',
  'is_confidential',
  'content_degraded',
])

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function assertUuid(field: string, value: string) {
  if (!UUID_RE.test(value)) {
    throw new ValidationError(`${field} 不是有效 UUID`)
  }
}

function normalizeFilters(
  raw: Record<string, unknown> | null | undefined
): DocSearchFilters {
  if (!raw || typeof raw !== 'object') return {}
  const out: DocSearchFilters = {}
  for (const [k, v] of Object.entries(raw)) {
    if (!FILTER_KEYS.has(k as DocSearchFilterKey)) {
      throw new ValidationError(`非法筛选项：${k}`)
    }
    if (v === null || v === undefined || v === '') continue
    if (k === 'content_degraded' || k === 'is_confidential') {
      if (typeof v === 'boolean') {
        ;(out as Record<string, boolean>)[k] = v
      } else if (v === 'true' || v === 'false') {
        ;(out as Record<string, boolean>)[k] = v === 'true'
      } else {
        throw new ValidationError(`${k} 须为 true / false`)
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

interface FileSearchRow extends Record<string, unknown> {
  id: string
  content: string | null
  snippets: unknown
  file_name: string
  file_ext: string | null
  file_type: string | null
  project_id: string
  project_name: string | null
  uploader_id: string
  uploader_name: string | null
  department_id: string | null
  department_name: string | null
  source_storage_key: string
  created_at: Date | string
  project_stage: string | null
  is_confidential: boolean | null
  can_access_content: boolean
  matched_by: 'metadata' | 'fulltext' | 'vector' | 'hybrid'
  total_count: number
  metadata_score: number | null
  keyword_score: number | null
  vector_score: number | null
  final_score: number | null
}

interface SearchSnippetRow {
  content?: string | null
  formatted?: string | null
  page_no?: number | null
  slide_no?: number | null
  sheet_name?: string | null
  row_start?: number | null
  row_end?: number | null
  chunk_index?: number | null
  rank_score?: number | null
}

function containsFilter(filters: DocSearchFilters, key: DocSearchFilterKey) {
  const value = filters[key]
  return value !== null && value !== undefined && value !== ''
}

function filterConditions(filters: DocSearchFilters) {
  const conds = []
  if (containsFilter(filters, 'department_id')) {
    conds.push(sql`f."department_id" = ${filters.department_id as string}::uuid`)
  }
  if (containsFilter(filters, 'project_id')) {
    conds.push(sql`f."project_id" = ${filters.project_id as string}::uuid`)
  }
  if (containsFilter(filters, 'uploader_id')) {
    conds.push(sql`f."uploader_id" = ${filters.uploader_id as string}::uuid`)
  }
  if (containsFilter(filters, 'project_stage')) {
    conds.push(sql`f."project_stage" = ${filters.project_stage as string}`)
  }
  if (containsFilter(filters, 'department_name')) {
    conds.push(sql`d."name" ilike ${`%${filters.department_name as string}%`}`)
  }
  if (containsFilter(filters, 'project_name')) {
    const q = `%${filters.project_name as string}%`
    conds.push(sql`(p."project_name" ilike ${q} or p."project_no" ilike ${q})`)
  }
  if (containsFilter(filters, 'file_name')) {
    conds.push(sql`f."file_name" ilike ${`%${filters.file_name as string}%`}`)
  }
  if (containsFilter(filters, 'file_type')) {
    const fileType = filters.file_type as string
    if (fileType === 'sales_file') {
      conds.push(sql`f."project_stage" = '销售阶段'`)
    } else if (fileType === 'deliverable') {
      conds.push(sql`f."is_deliverable" = true`)
    } else if (fileType.startsWith('reference_')) {
      const source = fileType.replace(/^reference_/, '')
      conds.push(sql`f."is_deliverable" is not true`)
      conds.push(sql`f."project_stage" <> '销售阶段'`)
      conds.push(sql`f."file_source"::text = ${source}`)
    } else {
      conds.push(sql`coalesce(f."business_type", '') = ${fileType}`)
    }
  }
  if (containsFilter(filters, 'file_ext')) {
    conds.push(sql`lower(coalesce(f."file_ext", '')) = lower(${filters.file_ext as string})`)
  }
  if (containsFilter(filters, 'is_confidential')) {
    conds.push(sql`f."is_confidential" is ${filters.is_confidential === true ? sql`true` : sql`false`}`)
  }
  return conds
}

function normalizeSnippets(raw: unknown): SearchSnippetRow[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      content: typeof item.content === 'string' ? item.content : null,
      formatted: typeof item.formatted === 'string' ? item.formatted : null,
      page_no: typeof item.page_no === 'number' ? item.page_no : null,
      slide_no: typeof item.slide_no === 'number' ? item.slide_no : null,
      sheet_name: typeof item.sheet_name === 'string' ? item.sheet_name : null,
      row_start: typeof item.row_start === 'number' ? item.row_start : null,
      row_end: typeof item.row_end === 'number' ? item.row_end : null,
      chunk_index: typeof item.chunk_index === 'number' ? item.chunk_index : null,
      rank_score: typeof item.rank_score === 'number' ? item.rank_score : null,
    }))
}

export async function searchDocuments(input: {
  q?: string
  mode?: DocSearchMode
  limit?: number
  offset?: number
  filters?: Record<string, unknown>
  crop_length?: number
  max_content_chars?: number
}) {
  const user = await requireUser()

  const limit = Math.min(200, Math.max(1, Number(input.limit) || 20))
  const offset = Math.max(0, Math.floor(Number(input.offset) || 0))
  const q = typeof input.q === 'string' ? input.q.trim() : ''
  const mode: DocSearchMode =
    input.mode === 'keyword' ||
    input.mode === 'semantic' ||
    input.mode === 'metadata'
      ? input.mode
      : 'hybrid'
  const filters = normalizeFilters(input.filters)
  const db = getDb()
  const departmentScopeIds = await getFileDepartmentScopeIds(user)

  const visibleSql = buildVisibleFileSql({
    userId: user.id,
    role: user.role,
    departmentScopeIds,
    fileAlias: 'f',
  })
  const canAccessContentSql = buildCanAccessContentSql({
    userId: user.id,
    role: user.role,
    departmentScopeIds,
    fileAlias: 'f',
  })

  const conds = [
    sql`f."deleted_at" is null`,
    sql`f."is_latest" = true`,
    visibleSql,
    ...filterConditions(filters),
  ]

  const hasQuery = q.length > 0
  const wantsKeyword = mode === 'hybrid' || mode === 'keyword'
  const wantsVector = mode === 'hybrid' || mode === 'semantic'
  const wantsMetadata = mode === 'hybrid' || mode === 'metadata'
  const startedAt = performance.now()
  const embedding = hasQuery && wantsVector ? await embedQueryText(q) : null
  const queryEmbedding = embedding?.vector ?? null
  const hasVectorQuery = Array.isArray(queryEmbedding) && queryEmbedding.length > 0
  const queryVectorLiteral = hasVectorQuery
    ? `[${queryEmbedding.map((v) => Number(v)).join(',')}]`
    : null

  const whereSql = sql.join(conds, sql` and `)
  const tsQuery = hasQuery
    ? sql`websearch_to_tsquery(${sql.raw(`'${QUERY_CONFIG}'`)}, ${q})`
    : sql`websearch_to_tsquery(${sql.raw(`'${QUERY_CONFIG}'`)}, '')`
  const like = `%${q}%`

  const rows = await db.execute<FileSearchRow>(sql`
    with visible_files as (
      select
        f."id",
        f."file_name",
        f."file_ext",
        case
          when f."project_stage" = '销售阶段' then 'sales_file'
          when f."is_deliverable" = true then 'deliverable'
          when f."file_source" is not null then 'reference_' || f."file_source"::text
          else coalesce(f."business_type", 'reference')
        end as "file_type",
        f."project_id",
        p."project_name",
        p."project_no",
        f."uploader_id",
        u."name" as "uploader_name",
        f."department_id",
        d."name" as "department_name",
        f."source_storage_key",
        f."created_at",
        f."project_stage",
        f."is_confidential",
        f."sales_file_tag",
        f."file_source",
        access."can_access_content",
        case
          when ${hasQuery} = true and ${wantsMetadata} = true then
            (case when f."file_name" ilike ${like} then 8 else 0 end)
            + (case when p."project_name" ilike ${like} then 5 else 0 end)
            + (case when p."project_no" ilike ${like} then 5 else 0 end)
            + (case when f."sales_file_tag" ilike ${like} then 4 else 0 end)
            + (case when f."file_source"::text ilike ${like} then 3 else 0 end)
            + (case when d."name" ilike ${like} then 2 else 0 end)
            + (case when u."name" ilike ${like} then 1 else 0 end)
          else 0
        end::double precision as "metadata_score"
      from "files" f
      join "projects" p on p."id" = f."project_id"
      left join "departments" d on d."id" = f."department_id"
      left join "users" u on u."id" = f."uploader_id"
      cross join lateral (
        select ${canAccessContentSql} as "can_access_content"
      ) access
      where ${whereSql}
    ),
    keyword_pool as (
      select
        fc."file_id", fc."content", fc."page_no", fc."slide_no", fc."sheet_name",
        fc."row_start", fc."row_end", fc."chunk_index",
        ts_headline(
          ${sql.raw(`'${FULLTEXT_CONFIG}'`)}, fc."content", ${tsQuery},
          'StartSel=<em>, StopSel=</em>, MaxWords=36, MinWords=12, ShortWord=2, HighlightAll=false'
        ) as "formatted",
        greatest(
          coalesce(ts_rank_cd(fc."search_vector", ${tsQuery}), 0),
          case when ${hasQuery} = true and fc."content" ilike ${like} then 0.2 else 0 end
        ) as "rank_score",
        1.0 / (${RRF_K} + row_number() over (
          order by greatest(
            coalesce(ts_rank_cd(fc."search_vector", ${tsQuery}), 0),
            case when ${hasQuery} = true and fc."content" ilike ${like} then 0.2 else 0 end
          ) desc, fc."chunk_index" asc
        )) as "rrf_score"
      from "file_chunks" fc
      where ${hasQuery} = true and ${wantsKeyword} = true
        and (fc."search_vector" @@ ${tsQuery} or fc."content" ilike ${like})
      order by "rank_score" desc, fc."chunk_index" asc
      limit ${CANDIDATE_POOL_SIZE}
    ),
    vector_pool as (
      select
        fc."file_id", fc."content", fc."page_no", fc."slide_no", fc."sheet_name",
        fc."row_start", fc."row_end", fc."chunk_index",
        1 - (fc."embedding" <=> ${queryVectorLiteral}::vector) as "score",
        1.0 / (${RRF_K} + row_number() over (
          order by fc."embedding" <=> ${queryVectorLiteral}::vector asc
        )) as "rrf_score"
      from "file_chunks" fc
      where ${hasVectorQuery} = true and ${wantsVector} = true and fc."embedding" is not null
      order by fc."embedding" <=> ${queryVectorLiteral}::vector asc
      limit ${CANDIDATE_POOL_SIZE}
    ),
    metadata_pool as (
      select vf."id"
      from visible_files vf
      where ${hasQuery} = false
        or (${wantsMetadata} = true and vf."metadata_score" > 0)
      order by vf."metadata_score" desc, vf."created_at" desc
      limit ${CANDIDATE_POOL_SIZE}
    ),
    candidate_file_ids as (
      -- Metadata is intentionally limited to matching rows.  For a blank
      -- query this preserves the browse view, otherwise chunk recall drives
      -- the query and avoids evaluating every visible file.
      select "file_id" as "id" from keyword_pool
      union
      select "file_id" as "id" from vector_pool
      union
      select "id" from metadata_pool
    ),
    ranked_files as (
      select
        vf.*,
        coalesce(cm."keyword_score", 0) as "keyword_score",
        vm."vector_score",
        (
          -- RRF makes keyword and cosine score scales comparable.  Metadata is
          -- a small deterministic tie-breaker rather than a dominant signal.
          (vf."metadata_score" / 100.0)
          + coalesce(cm."rrf_score", 0)
          + coalesce(vm."rrf_score", 0)
        )::double precision as "final_score",
        coalesce(cm."snippets", vm."snippets") as "snippets",
        coalesce(cm."best_content", vm."best_content") as "best_content",
        case
          when ${hasQuery} = false then 'metadata'
          when (cm."keyword_score" is not null or vm."vector_score" is not null) and vf."metadata_score" > 0 then 'hybrid'
          when cm."keyword_score" is not null and vm."vector_score" is not null then 'hybrid'
          when cm."keyword_score" is not null then 'fulltext'
          when vm."vector_score" is not null then 'vector'
          else 'metadata'
        end as "matched_by"
      from candidate_file_ids c
      join visible_files vf on vf."id" = c."id"
      left join lateral (
        select
          max(m."rank_score") as "keyword_score",
          max(m."rrf_score") as "rrf_score",
          (array_agg(m."content" order by m."rank_score" desc, m."chunk_index" asc))[1] as "best_content",
          jsonb_agg(
            jsonb_build_object(
              'content', m."content",
              'formatted', m."formatted",
              'page_no', m."page_no",
              'slide_no', m."slide_no",
              'sheet_name', m."sheet_name",
              'row_start', m."row_start",
              'row_end', m."row_end",
              'chunk_index', m."chunk_index",
              'rank_score', m."rank_score"
            )
            order by m."rank_score" desc, m."chunk_index" asc
          ) as "snippets"
        from (
          select * from keyword_pool
          where "file_id" = vf."id"
          order by "rank_score" desc, "chunk_index" asc
          limit ${MAX_SNIPPETS_PER_FILE}
        ) m
      ) cm on true
      left join lateral (
        select
          max(v."score") as "vector_score",
          max(v."rrf_score") as "rrf_score",
          (array_agg(v."content" order by v."score" desc, v."chunk_index" asc))[1] as "best_content",
          jsonb_agg(
            jsonb_build_object(
              'content', v."content",
              'formatted', null,
              'page_no', v."page_no",
              'slide_no', v."slide_no",
              'sheet_name', v."sheet_name",
              'row_start', v."row_start",
              'row_end', v."row_end",
              'chunk_index', v."chunk_index",
              'rank_score', v."score"
            )
            order by v."score" desc, v."chunk_index" asc
          ) as "snippets"
        from (
          select * from vector_pool
          where "file_id" = vf."id"
          order by "score" desc, "chunk_index" asc
          limit 3
        ) v
      ) vm on true
      where ${hasQuery} = false
        or (${wantsMetadata} = true and vf."metadata_score" > 0)
        or (${wantsKeyword} = true and cm."keyword_score" is not null)
        or (${wantsVector} = true and vm."vector_score" is not null)
    )
    select
      f."id",
      case when f."can_access_content" then f."best_content" else null end as "content",
      case when f."can_access_content" then coalesce(f."snippets", '[]'::jsonb) else '[]'::jsonb end as "snippets",
      f."file_name",
      f."file_ext",
      f."file_type",
      f."project_id",
      f."project_name",
      f."uploader_id",
      f."uploader_name",
      f."department_id",
      f."department_name",
      f."source_storage_key",
      f."created_at",
      f."project_stage",
      f."is_confidential",
      f."can_access_content",
      f."matched_by",
      count(*) over()::int as "total_count",
      f."metadata_score",
      f."keyword_score",
      f."vector_score",
      f."final_score"
    from ranked_files f
    order by
      f."final_score" desc,
      case when ${hasQuery} = true and f."file_name" ilike ${like} then 1 else 0 end desc,
      f."created_at" desc
    limit ${limit}
    offset ${offset}
  `)

  const maxContentChars =
    input.max_content_chars != null && Number.isFinite(input.max_content_chars)
      ? Math.max(0, Math.floor(Number(input.max_content_chars)))
      : 600

  const processingTimeMs = Math.round(performance.now() - startedAt)
  if (processingTimeMs > 1_000 || embedding?.vector === null) {
    console.info('[file-search]', {
      processingTimeMs,
      mode,
      hasQuery,
      resultCount: rows.length,
      embedding: embedding?.vector ? (embedding.cacheHit ? 'cache' : 'ok') : (embedding?.reason ?? 'not_requested'),
    })
  }

  return {
    hits: rows.map((row) => {
      const content = row.content?.trim()
      const snippets = normalizeSnippets(row.snippets)
        .map((snippet) => ({
          content: (snippet.content || '').slice(0, maxContentChars || undefined),
          formatted: snippet.formatted || undefined,
          page_no: snippet.page_no ?? undefined,
          slide_no: snippet.slide_no ?? undefined,
          sheet_name: snippet.sheet_name ?? undefined,
          row_start: snippet.row_start ?? undefined,
          row_end: snippet.row_end ?? undefined,
          chunk_index: snippet.chunk_index ?? 0,
          rank_score: snippet.rank_score ?? undefined,
        }))
        .filter((snippet) => snippet.content || snippet.formatted)
      return {
        id: row.id,
        content:
          content && maxContentChars > 0
            ? content.slice(0, maxContentChars)
            : content || undefined,
        snippets,
        content_degraded: !content,
        file_name: row.file_name,
        file_ext: row.file_ext ?? undefined,
        file_type: row.file_type ?? undefined,
        project_id: row.project_id,
        project_name: row.project_name ?? undefined,
        uploader_id: row.uploader_id,
        uploader_name: row.uploader_name ?? undefined,
        department_id: row.department_id ?? undefined,
        department_name: row.department_name ?? undefined,
        source_storage_key: row.source_storage_key,
        created_at:
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : String(row.created_at),
        project_stage: row.project_stage ?? undefined,
        is_confidential: row.is_confidential === true,
        can_access_content: row.can_access_content === true,
        matched_by: row.matched_by,
        metadata_score: row.metadata_score,
        keyword_score: row.keyword_score,
        vector_score: row.vector_score,
        final_score: row.final_score,
        disabled_reason:
          row.can_access_content === true
            ? undefined
            : '保密文件，无内容权限',
      }
    }),
    query: q,
    limit,
    offset,
    estimatedTotalHits: rows[0]?.total_count ?? 0,
    processingTimeMs,
    mode,
  }
}
