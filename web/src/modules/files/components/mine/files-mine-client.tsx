'use client'

import {
  Chip,
  Input,
  Spinner,
} from '@heroui/react'
import { Icon } from '@iconify/react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'

import {
  PROJECT_STAGE_LABEL,
  type ProjectStageValue,
} from '@/constants/project-stage'
import { showResultError } from '@/core/client/errors'
import ProjectSearchSelect from '@/modules/projects/components/project-search-select'
import ProjectStageSelect from '@/modules/projects/components/project-stage-select'
import FileTypeIcon from '@/modules/files/components/upload/file-type-icon'
import { referenceFileSourceLabel } from '@/modules/files/lib/reference-file-source'
import { loadMineFilesPageAction } from '@/modules/files/mine/actions'
import type { MineFileRow } from '@/modules/files/types'

const STAGE_COLOR: Record<string, 'primary' | 'warning' | 'default'> = {
  实施阶段: 'primary',
  销售阶段: 'warning',
}

interface UploadedFileProjectOption {
  id: string
  project_no: string | null
  project_name: string | null
}

function formatWhen(iso: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16)
  const pad2 = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}`
}

function fileTypeLabel(row: MineFileRow): string {
  if (row.project_stage === '销售阶段') return row.sales_file_tag || '-'
  if (row.is_deliverable) return '项目成果文件'
  return referenceFileSourceLabel(row.file_source)
}

export default function FilesMineClient({
  initialSearch,
  initialProjectId,
  initialProjectStage,
  projectOptions,
  initialRows,
  initialHasMore,
}: {
  initialSearch: string
  initialProjectId: string
  initialProjectStage: string
  projectOptions: UploadedFileProjectOption[]
  initialRows: MineFileRow[]
  initialHasMore: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [rows, setRows] = useState<MineFileRow[]>(initialRows)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searchDraft, setSearchDraft] = useState(initialSearch)
  const [isPending, startTransition] = useTransition()
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const loadingRef = useRef(false)

  const currentSearch = (searchParams.get('q') ?? '').trim()
  const currentProjectId = (searchParams.get('projectId') ?? '').trim()
  const currentStage = (searchParams.get('stage') ?? '').trim()

  useEffect(() => {
    setRows(initialRows)
    setHasMore(initialHasMore)
  }, [initialRows, initialHasMore])

  useEffect(() => {
    setSearchDraft(initialSearch)
  }, [initialSearch])

  const replaceFilters = useCallback(
    (next: { q?: string; projectId?: string; stage?: string }) => {
      const q = next.q ?? currentSearch
      const projectId = next.projectId ?? currentProjectId
      const stage = next.stage ?? currentStage
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (projectId.trim()) params.set('projectId', projectId.trim())
      if (stage.trim()) params.set('stage', stage.trim())
      startTransition(() => {
        router.replace(`/weekly/files?${params.toString()}`)
      })
    },
    [currentProjectId, currentSearch, currentStage, router]
  )

  const applySearch = useCallback(() => {
    replaceFilters({ q: searchDraft })
  }, [replaceFilters, searchDraft])

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingRef.current) return
    loadingRef.current = true
    setLoadingMore(true)
    const res = await loadMineFilesPageAction({
      offset: rows.length,
      fileNameQuery: currentSearch || null,
      projectId: currentProjectId || null,
      projectStage: currentStage || null,
    })
    loadingRef.current = false
    setLoadingMore(false)
    if (!res.success) {
      showResultError(res, '加载失败')
      return
    }
    setRows((prev) => {
      const seen = new Set(prev.map((r) => r.file_id))
      const next = [...prev]
      for (const r of res.data.rows) {
        if (!seen.has(r.file_id)) {
          seen.add(r.file_id)
          next.push(r)
        }
      }
      return next
    })
    setHasMore(res.data.hasMore)
  }, [currentProjectId, currentSearch, currentStage, hasMore, rows.length])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore()
      },
      { root: null, rootMargin: '120px', threshold: 0 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [loadMore])

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Input
          aria-label="文件名称"
          size="sm"
          variant="bordered"
          placeholder="文件名称"
          value={searchDraft}
          onValueChange={setSearchDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              applySearch()
            }
          }}
          className="lg:w-72"
          startContent={
            <Icon icon="lucide:search" className="size-4 text-default-400" aria-hidden />
          }
          isClearable
          onClear={() => replaceFilters({ q: '' })}
        />

        <ProjectSearchSelect
          projects={projectOptions}
          value={initialProjectId}
          onChange={(projectId) => replaceFilters({ projectId })}
          label=""
          placeholder="全部项目"
          emptyOptionLabel="全部项目"
          size="sm"
          variant="bordered"
          className="lg:w-80"
        />

        <ProjectStageSelect
          value={initialProjectStage}
          onChange={(stage) => replaceFilters({ stage })}
          className="min-w-0 lg:w-40"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-default-200 bg-content1 shadow-sm">
        <table className="min-w-full divide-y divide-default-100 text-sm">
          <thead>
            <tr className="bg-default-50/80 text-left text-xs text-default-600">
              <th className="px-4 py-3 font-medium">文件</th>
              <th className="px-4 py-3 font-medium">项目</th>
              <th className="px-4 py-3 font-medium">阶段</th>
              <th className="px-4 py-3 font-medium">文件类型/标签</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">上传时间</th>
              <th className="w-24 px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-default-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-default-500">
                  {isPending ? '加载中...' : '暂无文件'}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.file_id} className="hover:bg-default-50/50">
                  <td className="px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <FileTypeIcon
                        fileName={r.file_name}
                        className="size-5 shrink-0 object-contain"
                      />
                      <span className="min-w-0 break-all font-medium text-foreground">
                        {r.file_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-default-600">
                    {r.project_name ?? '-'}
                  </td>
                  <td className="px-4 py-3">
                    <Chip
                      size="sm"
                      variant="flat"
                      color={STAGE_COLOR[r.project_stage] ?? 'default'}
                    >
                      {PROJECT_STAGE_LABEL[r.project_stage as ProjectStageValue] ??
                        r.project_stage}
                    </Chip>
                  </td>
                  <td className="px-4 py-3 text-default-600">
                    <Chip size="sm" variant="flat" color="default">
                      {fileTypeLabel(r)}
                    </Chip>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-default-500 tabular-nums">
                    {formatWhen(r.sort_at)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/files/${r.file_id}/preview`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      预览
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {hasMore ? (
        <div
          ref={sentinelRef}
          className="flex min-h-10 items-center justify-center py-4"
          aria-hidden
        >
          {loadingMore ? <Spinner size="sm" label="加载中" color="primary" /> : null}
        </div>
      ) : null}
    </>
  )
}
