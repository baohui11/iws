'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { showResultError } from '@/core/client/errors'
import {
  Button,
  Checkbox,
  Chip,
  Select,
  SelectItem,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react'
import { Icon } from '@iconify/react'
import NextLink from 'next/link'
import { loadProjectFilesPage } from '@/modules/files/project-files/actions'
import FileTypeIcon from '@/modules/files/components/upload/file-type-icon'
import { formatFileSize } from '@/modules/files/lib/format-file-size'
import { formatUploadDateShort } from '@/modules/files/lib/format-upload-date'
import {
  PROJECT_FILE_TYPE_CATEGORY_LABEL,
  type ProjectFileTypeCategory,
} from '@/modules/files/lib/project-file-type-category'
import type {
  ListProjectFilesFilters,
  ProjectFileListRow,
  ProjectFilesScope,
} from '@/modules/files/types'
import {
  PROJECT_STAGE_LABEL,
  PROJECT_STAGE_SALES,
  type ProjectStageValue,
} from '@/constants/project-stage'

const PAGE_SIZE = 30

const SCOPE_OPTIONS: { key: ProjectFilesScope; label: string }[] = [
  { key: 'all', label: '全部文件' },
  { key: 'deliverable', label: '成果文件' },
  { key: 'reference', label: '参考资料' },
]

const REF_SOURCE_OPTIONS: { key: string; label: string }[] = [
  { key: 'all', label: '全部来源' },
  { key: 'client', label: '客户资料' },
  { key: 'internal', label: '内部资料' },
  { key: 'public', label: '公开资料' },
]

const REF_SOURCE_LABEL = Object.fromEntries(
  REF_SOURCE_OPTIONS.filter((o) => o.key !== 'all').map((o) => [o.key, o.label])
) as Record<string, string>

const TYPE_OPTIONS: { key: ProjectFileTypeCategory; label: string }[] = (
  Object.entries(PROJECT_FILE_TYPE_CATEGORY_LABEL) as [
    ProjectFileTypeCategory,
    string,
  ][]
).map(([key, label]) => ({ key, label }))

interface ProjectFilesTabProps {
  projectId: string
  projectStage?: ProjectStageValue
}

function projectFileRowTagChips(row: ProjectFileListRow) {
  const out: { key: string; label: string; color: 'primary' | 'secondary' | 'success' | 'warning' }[] =
    []
  out.push({
    key: 'stage',
    label: PROJECT_STAGE_LABEL[row.project_stage] ?? row.project_stage,
    color: row.project_stage === PROJECT_STAGE_SALES ? 'warning' : 'primary',
  })
  if (row.project_stage === PROJECT_STAGE_SALES && row.sales_file_tag) {
    out.push({ key: 'sales-tag', label: row.sales_file_tag, color: 'secondary' })
  }
  if (row.is_deliverable) {
    if (row.contract_deliverable_id) {
      out.push({ key: 'contract', label: '合同成果', color: 'primary' })
    } else {
      out.push({ key: 'deliverable', label: '成果', color: 'primary' })
    }
  } else {
    const src = row.file_source?.trim()
    if (src) {
      const label = REF_SOURCE_LABEL[src] ?? src
      out.push({ key: 'ref-src', label, color: 'secondary' })
    }
  }
  if (row.is_deliverable && row.is_latest) {
    out.push({ key: 'latest', label: '最新版', color: 'success' })
  }
  if (row.is_confidential) {
    out.push({ key: 'conf', label: '敏感', color: 'warning' })
  }
  return out
}

function FilePreviewLink({ fileId }: { fileId: string }) {
  return (
    <Button
      as={NextLink}
      href={`/files/${fileId}/preview`}
      isIconOnly
      size="sm"
      variant="light"
      aria-label="预览"
      className="text-default-500"
    >
      <Icon icon="lucide:scan-eye" className="size-[1.125rem]" aria-hidden />
    </Button>
  )
}

export default function ProjectFilesTab({
  projectId,
  projectStage,
}: ProjectFilesTabProps) {
  const [scope, setScope] = useState<ProjectFilesScope>('all')
  const [contractOnly, setContractOnly] = useState(false)
  const [latestOnly, setLatestOnly] = useState(true)
  const [refSource, setRefSource] = useState('all')
  const [typeCat, setTypeCat] = useState<ProjectFileTypeCategory>('all')

  const [rows, setRows] = useState<ProjectFileListRow[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const filters = useMemo((): ListProjectFilesFilters => {
    const f: ListProjectFilesFilters = {
      scope,
      typeCategory: typeCat,
      projectStage,
    }
    if (scope === 'deliverable') {
      f.contractDeliverOnly = contractOnly
      f.latestOnly = latestOnly
    }
    if (scope === 'reference') {
      f.referenceSource = refSource
    }
    return f
  }, [scope, contractOnly, latestOnly, refSource, typeCat, projectStage])

  useEffect(() => {
    let cancelled = false
    // 筛选条件变化时重新拉取项目文件首页（外部数据同步）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setRows([])
    setHasMore(true)
    void (async () => {
      const result = await loadProjectFilesPage(
        projectId,
        filters,
        0,
        PAGE_SIZE
      )
      if (cancelled) return
      setLoading(false)
      if (!result.success) {
        showResultError(result, '加载失败')
        return
      }
      setRows(result.data.rows)
      setHasMore(result.data.hasMore)
    })()
    return () => {
      cancelled = true
    }
  }, [projectId, filters])

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading) return
    setLoadingMore(true)
    const result = await loadProjectFilesPage(
      projectId,
      filters,
      rows.length,
      PAGE_SIZE
    )
    setLoadingMore(false)
    if (!result.success) {
      showResultError(result, '加载失败')
      return
    }
    const page = result.data
    setRows((prev) => [...prev, ...page.rows])
    setHasMore(page.hasMore)
  }, [
    projectId,
    filters,
    hasMore,
    loadingMore,
    loading,
    rows.length,
  ])

  const loadMoreRef = useRef(loadMore)
  useEffect(() => {
    loadMoreRef.current = loadMore
  })

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore || loading) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMoreRef.current()
        }
      },
      { root: null, rootMargin: '120px', threshold: 0 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, loading])

  const filterSelectClass =
    'min-h-8 w-full min-w-[7.5rem] max-w-[13rem] sm:min-w-[9rem] sm:max-w-[12rem] sm:w-[11.5rem]'

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-default-200/80 bg-default-50/50 p-3">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="w-9 shrink-0 text-xs font-medium text-default-500">
              范围
            </span>
            <div className="flex flex-wrap gap-1">
              {SCOPE_OPTIONS.map((opt) => (
                <Button
                  key={opt.key}
                  size="sm"
                  variant={scope === opt.key ? 'flat' : 'bordered'}
                  color={scope === opt.key ? 'primary' : 'default'}
                  className="h-8 min-h-8 px-2.5 text-xs"
                  onPress={() => setScope(opt.key)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center justify-end gap-x-2 gap-y-1.5 sm:ml-auto sm:w-auto sm:gap-x-3">
            {scope === 'deliverable' ? (
              <>
                <Checkbox
                  size="sm"
                  classNames={{ base: 'max-w-full', label: 'text-xs' }}
                  isSelected={contractOnly}
                  onValueChange={setContractOnly}
                >
                  仅合同成果
                </Checkbox>
                <Checkbox
                  size="sm"
                  classNames={{ base: 'max-w-full', label: 'text-xs' }}
                  isSelected={latestOnly}
                  onValueChange={setLatestOnly}
                >
                  仅最新版本
                </Checkbox>
              </>
            ) : null}
            {scope === 'reference' ? (
              <Select
                aria-label="参考资料来源"
                size="sm"
                variant="flat"
                className={filterSelectClass}
                classNames={{
                  trigger: 'h-8 min-h-8',
                  value: 'text-xs',
                }}
                selectedKeys={new Set([refSource])}
                onSelectionChange={(keys) => {
                  const k = [...keys][0] as string | undefined
                  if (k) setRefSource(k)
                }}
                items={REF_SOURCE_OPTIONS}
              >
                {(item) => (
                  <SelectItem key={item.key} textValue={item.label}>
                    {item.label}
                  </SelectItem>
                )}
              </Select>
            ) : null}
            <Select
              aria-label="文件类型"
              size="sm"
              variant="flat"
              className={filterSelectClass}
              classNames={{
                trigger: 'h-8 min-h-8',
                value: 'text-xs',
              }}
              selectedKeys={new Set([typeCat])}
              onSelectionChange={(keys) => {
                const k = [...keys][0] as ProjectFileTypeCategory | undefined
                if (k) setTypeCat(k)
              }}
              items={TYPE_OPTIONS}
            >
              {(item) => (
                <SelectItem key={item.key} textValue={item.label}>
                  {item.label}
                </SelectItem>
              )}
            </Select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner label="加载中…" />
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-default-200 bg-default-50/40 py-12 text-center text-sm text-default-500">
          暂无文件
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-default-200/80">
            <Table
              aria-label="项目文件列表"
              removeWrapper
              classNames={{
                th: 'bg-default-100/80 px-3 py-2 text-xs text-default-600 whitespace-nowrap',
                td: 'border-b border-default-100 px-3 py-2',
              }}
            >
              <TableHeader>
                <TableColumn className="w-12"> </TableColumn>
                <TableColumn>文件名</TableColumn>
                <TableColumn>大小</TableColumn>
                <TableColumn>上传者</TableColumn>
                <TableColumn>上传时间</TableColumn>
                <TableColumn className="min-w-[10rem] max-w-[18rem]">标签</TableColumn>
                <TableColumn className="w-24">预览</TableColumn>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const tags = projectFileRowTagChips(r)
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <FileTypeIcon fileName={r.file_name} className="size-5" />
                      </TableCell>
                      <TableCell className="max-w-[min(280px,40vw)]">
                        <span className="line-clamp-2 font-medium" title={r.file_name}>
                          {r.file_name}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums text-default-600">
                        {formatFileSize(r.file_size)}
                      </TableCell>
                      <TableCell className="text-sm">{r.uploader_name ?? '—'}</TableCell>
                      <TableCell className="whitespace-nowrap text-default-500">
                        {formatUploadDateShort(r.created_at)}
                      </TableCell>
                      <TableCell>
                        {tags.length === 0 ? (
                          <span className="text-xs text-default-400">—</span>
                        ) : (
                          <div className="flex max-w-full flex-wrap gap-1">
                            {tags.map((t) => (
                              <Chip
                                key={`${r.id}-${t.key}`}
                                size="sm"
                                variant="flat"
                                color={t.color}
                              >
                                {t.label}
                              </Chip>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <FilePreviewLink fileId={r.id} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div ref={sentinelRef} className="flex min-h-10 justify-center py-4">
            {loadingMore ? <Spinner size="sm" /> : null}
            {!hasMore && rows.length > 0 ? (
              <span className="text-xs text-default-400">已加载全部</span>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
