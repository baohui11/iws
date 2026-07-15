'use client'

import {
  Button,
  Chip,
  Divider,
  ScrollShadow,
  Skeleton,
  Spinner,
  Tooltip,
  addToast,
} from '@heroui/react'
import { Icon } from '@iconify/react'
import clsx from 'clsx'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SubpageBackButton } from '@/components/common/subpage-header'
import {
  showErrorToast,
  unwrapResultOrToast,
} from '@/core/client/errors'
import { downloadProjectFile } from '@/modules/files/download/client'
import { loadFilePreview } from '@/modules/files/preview/actions'
import { formatFileSize } from '@/modules/files/lib/format-file-size'
import { PreviewProtectedShell } from '@/modules/files/components/preview/preview-protected-shell'
import { PreviewWatermark } from '@/modules/files/components/preview/preview-watermark'
import { PreviewCsv } from '@/modules/files/components/preview/renderers/preview-csv'
import { PreviewExcel } from '@/modules/files/components/preview/renderers/preview-excel'
import { PreviewImage } from '@/modules/files/components/preview/renderers/preview-image'
import { PreviewMarkdown } from '@/modules/files/components/preview/renderers/preview-markdown'
import { PreviewMedia } from '@/modules/files/components/preview/renderers/preview-media'
import { PreviewText } from '@/modules/files/components/preview/renderers/preview-text'
import { PreviewUnsupported } from '@/modules/files/components/preview/renderers/preview-unsupported'
import FilePreviewInteractionPanel from '@/modules/files/components/preview/file-preview-interaction-panel'
import { FileProcessStatusStrip } from '@/modules/files/components/preview/file-process-status-strip'
import type { FilePreviewLoadResult } from '@/modules/files/types'

type ProcessStatus = FilePreviewLoadResult['processStatus']

type ProcessStatusResponse = {
  fileId: string
  tasks: Array<{
    stage: 'preview' | 'parse' | 'index'
    status: string
  }>
}

const TERMINAL_STATUS = new Set(['ready', 'failed', 'skipped'])

const PreviewPdf = dynamic(
  () => import('./renderers/preview-pdf').then((m) => m.PreviewPdf),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[360px] flex-1 items-center justify-center">
        <Spinner label="加载 PDF" />
      </div>
    ),
  }
)

function isActiveStatus(status: ProcessStatus): boolean {
  return Object.values(status).some(
    (s) => s === 'pending' || s === 'processing'
  )
}

function previewNeedsReload(prev: ProcessStatus, next: ProcessStatus): boolean {
  const before = prev.preview
  const after = next.preview
  return (
    before !== after &&
    (before === 'pending' || before === 'processing') &&
    !!after &&
    TERMINAL_STATUS.has(after)
  )
}

function toProcessStatus(data: ProcessStatusResponse): ProcessStatus {
  const status: ProcessStatus = {
    preview: null,
    parse: null,
    index: null,
  }
  for (const task of data.tasks) {
    status[task.stage] = task.status
  }
  return status
}

function previewKindLabel(data: FilePreviewLoadResult): string {
  const ext = data.fileExt?.trim()
  if (ext) return ext.toUpperCase()
  switch (data.payload.kind) {
    case 'pdf':
      return 'PDF'
    case 'image':
      return '图片'
    case 'excel':
    case 'csv':
      return '表格'
    case 'markdown':
      return 'Markdown'
    case 'text':
      return '文本'
    case 'media':
      return data.payload.media === 'video' ? '视频' : '音频'
    default:
      return '文件'
  }
}

function renderPayload(data: FilePreviewLoadResult) {
  const { payload } = data
  switch (payload.kind) {
    case 'text':
      return <PreviewText text={payload.text} />
    case 'csv':
      return <PreviewCsv rows={payload.rows} truncated={payload.truncated} />
    case 'markdown':
      return <PreviewMarkdown text={payload.text} />
    case 'image':
      return <PreviewImage signedUrl={payload.signedUrl} />
    case 'pdf':
      return <PreviewPdf signedUrl={payload.signedUrl} />
    case 'media':
      return <PreviewMedia signedUrl={payload.signedUrl} media={payload.media} />
    case 'excel':
      return <PreviewExcel data={payload.data} />
    case 'unsupported':
      return <PreviewUnsupported message={payload.message} />
    default:
      return <PreviewUnsupported message="暂不支持预览" />
  }
}

function formatWatermarkTime(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace(/\//g, '-')
}

const PREVIEW_PAGE_HEIGHT_CLASS =
  'h-[calc(100svh-60px)] max-h-[calc(100svh-60px)]'

type PreviewViewMode = 'preview' | 'info'

function LoadingPreview() {
  return (
    <div
      className={`flex ${PREVIEW_PAGE_HEIGHT_CLASS} flex-col overflow-hidden bg-default-50`}
    >
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-default-200 bg-background/95 px-3 md:px-5">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-48 rounded" />
          <Skeleton className="h-3 w-72 rounded" />
        </div>
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,240px)] gap-3 overflow-hidden p-3 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-none lg:p-4">
        <Skeleton className="min-h-[60vh] rounded-lg" />
        <Skeleton className="hidden rounded-lg lg:block" />
      </div>
    </div>
  )
}

function EmptyPreview() {
  return (
    <div
      className={`flex ${PREVIEW_PAGE_HEIGHT_CLASS} flex-col items-center justify-center overflow-hidden bg-default-50 p-6`}
    >
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <Icon icon="lucide:file-x" className="size-12 text-default-400" />
        <p className="text-sm text-default-600">无法加载预览</p>
      </div>
    </div>
  )
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace(/\//g, '-')
}

function sourceLabel(data: FilePreviewLoadResult): string {
  if (data.projectStage === '销售阶段') {
    return data.salesFileTag ? `销售资料-${data.salesFileTag}` : '销售资料'
  }
  if (data.isDeliverable) return '成果文件'
  if (data.fileSource === 'client') return '参考资料-客户资料'
  if (data.fileSource === 'internal') return '参考资料-内部资料'
  if (data.fileSource === 'public') return '参考资料-公开资料'
  if (data.fileSource === 'original') return '参考资料-项目成果文件'
  return data.businessType ? `参考资料-${data.businessType}` : '参考资料'
}

function chunkLocation(chunk: FilePreviewLoadResult['chunks'][number]) {
  if (chunk.slideNo) return `第 ${chunk.slideNo} 页`
  if (chunk.pageNo) return `第 ${chunk.pageNo} 页`
  if (chunk.sheetName) {
    const rows =
      chunk.rowStart && chunk.rowEnd
        ? ` · ${chunk.rowStart}-${chunk.rowEnd} 行`
        : ''
    return `${chunk.sheetName}${rows}`
  }
  return `切块 ${chunk.chunkIndex + 1}`
}

function InfoGrid({
  items,
}: {
  items: Array<[string, string | number | null | undefined]>
}) {
  return (
    <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="min-w-0 rounded-md border border-default-200 bg-default-50 px-3 py-2 dark:bg-default-100/20"
        >
          <dt className="text-xs text-default-500">{label}</dt>
          <dd className="mt-1 min-w-0 truncate font-medium text-foreground">
            {value || '—'}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function FileInfoView({
  data,
  onSocialUpdate,
  onTopLevelCommentAdded,
}: {
  data: FilePreviewLoadResult
  onSocialUpdate: (
    patch: Partial<
      Pick<FilePreviewLoadResult, 'interactions' | 'recommendStats'>
    >
  ) => void
  onTopLevelCommentAdded: (
    comment: FilePreviewLoadResult['comments'][number]
  ) => void
}) {
  const [chunksOpen, setChunksOpen] = useState(false)
  const baseItems: Array<[string, string | number | null | undefined]> = [
    ['文件类型', previewKindLabel(data)],
    ['文件大小', formatFileSize(data.fileSize)],
    ['文件分类', sourceLabel(data)],
    ['项目', data.projectName || data.projectNo],
    ['所属部门', data.departmentName],
    ['项目阶段', data.projectStage],
    ['上传人', data.uploaderName],
    ['上传时间', formatDateTime(data.createdAt)],
    ['MIME', data.mimeType],
  ]
  const versionItems: Array<[string, string | number | null | undefined]> = [
    ['当前版本', `V${data.versionNo}${data.versionLabel ? ` · ${data.versionLabel}` : ''}`],
    ['是否最新', data.isLatest ? '是' : '否'],
    ['成果清单', data.contractDeliverableName],
    ['原始文件名', data.originalFileName],
  ]
  const showVersionSection =
    data.projectStage === '实施阶段' && data.isDeliverable

  return (
    <ScrollShadow className="h-full">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
        <section className="rounded-lg border border-default-200 bg-content1 p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">基础信息</h2>
            <div className="flex gap-2">
              {data.isConfidential ? (
                <Chip size="sm" color="warning" variant="flat">
                  保密
                </Chip>
              ) : null}
              {data.canPreview ? (
                <Chip size="sm" color="success" variant="flat">
                  可预览
                </Chip>
              ) : (
                <Chip size="sm" color="warning" variant="flat">
                  仅元数据
                </Chip>
              )}
            </div>
          </div>
          <InfoGrid items={baseItems} />
        </section>

        {showVersionSection ? (
          <section className="rounded-lg border border-default-200 bg-content1 p-4 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-foreground">
              版本信息
            </h2>
            <InfoGrid items={versionItems} />
            {data.versions.length > 1 ? (
              <>
                <Divider className="my-4" />
                <div className="space-y-2">
                  {data.versions.map((version) => {
                    const current = version.fileId === data.fileId
                    return (
                      <div
                        key={version.fileId}
                        className="flex items-center gap-3 rounded-md border border-default-200 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-foreground">
                              V{version.versionNo}
                            </span>
                            {version.versionLabel ? (
                              <span className="text-sm text-default-500">
                                {version.versionLabel}
                              </span>
                            ) : null}
                            {version.isLatest ? (
                              <Chip size="sm" color="primary" variant="flat">
                                最新
                              </Chip>
                            ) : null}
                            {current ? (
                              <Chip size="sm" variant="flat">
                                当前
                              </Chip>
                            ) : null}
                          </div>
                          <p className="mt-1 truncate text-xs text-default-500">
                            {version.fileName} · {formatDateTime(version.createdAt)}
                          </p>
                        </div>
                        {current ? null : (
                          <Button
                            as={Link}
                            href={`/files/${version.fileId}/preview`}
                            size="sm"
                            variant="flat"
                          >
                            查看
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        <section className="rounded-lg border border-default-200 bg-content1 shadow-sm">
          {data.canPreview ? (
            <FilePreviewInteractionPanel
              fileId={data.fileId}
              favorite={data.interactions.favorite}
              recommend={data.interactions.recommend}
              recommendStats={data.recommendStats}
              topLevelComments={data.comments}
              onSocialUpdate={onSocialUpdate}
              onTopLevelCommentAdded={onTopLevelCommentAdded}
            />
          ) : (
            <div className="p-4 text-sm text-default-500">
              无内容权限，互动信息暂不展示。
            </div>
          )}
        </section>

        <section className="rounded-lg border border-default-200 bg-content1 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                文件切块
              </h2>
              <p className="mt-1 text-sm text-default-500">
                {data.chunkTotal > 0
                  ? `共 ${data.chunkTotal} 个切块，当前显示前 ${data.chunks.length} 个`
                  : '暂无切块数据'}
              </p>
            </div>
            <Button
              size="sm"
              variant="flat"
              isDisabled={data.chunks.length === 0}
              endContent={
                <Icon
                  icon={chunksOpen ? 'lucide:chevron-up' : 'lucide:chevron-down'}
                  className="size-4"
                />
              }
              onPress={() => setChunksOpen((open) => !open)}
            >
              {chunksOpen ? '收起' : '查看'}
            </Button>
          </div>
          {chunksOpen ? (
            <div className="mt-4 space-y-2">
              {data.chunks.map((chunk) => (
                <div
                  key={chunk.id}
                  className="rounded-md border border-default-200 bg-default-50 p-3 dark:bg-default-100/20"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-default-500">
                    <span>{chunkLocation(chunk)}</span>
                    {chunk.sectionTitle ? <span>{chunk.sectionTitle}</span> : null}
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-default-700">
                    {chunk.content}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </ScrollShadow>
  )
}

export default function FilePreviewPageClient({
  fileId,
  returnTo,
}: {
  fileId: string
  returnTo?: string
}) {
  const [data, setData] = useState<FilePreviewLoadResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [statusRefreshing, setStatusRefreshing] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [viewMode, setViewMode] = useState<PreviewViewMode>('preview')
  const previewHostRef = useRef<HTMLDivElement>(null)
  const [previewFullscreen, setPreviewFullscreen] = useState(false)
  const [watermarkTime] = useState(() => new Date())

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'refresh') => {
      if (mode === 'initial') setLoading(true)
      else setRefreshing(true)

      const res = await loadFilePreview(fileId)

      setLoading(false)
      setRefreshing(false)
      const nextData = unwrapResultOrToast(res, '无法预览')
      if (!nextData) {
        setData(null)
        return
      }
      setData(nextData)
    },
    [fileId]
  )

  const refreshProcessStatus = useCallback(async () => {
    const current = data
    if (!current) return
    setStatusRefreshing(true)
    try {
      const res = await fetch(
        `/api/files/${encodeURIComponent(fileId)}/process-status`,
        {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        }
      )
      if (!res.ok) return
      const payload = (await res.json()) as ProcessStatusResponse
      const nextStatus = toProcessStatus(payload)
      const shouldReload = previewNeedsReload(current.processStatus, nextStatus)

      setData((prev) =>
        prev ? { ...prev, processStatus: nextStatus } : prev
      )

      if (shouldReload) {
        await load('refresh')
      }
    } finally {
      setStatusRefreshing(false)
    }
  }, [data, fileId, load])

  useEffect(() => {
    void load('initial')
  }, [load])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    if (!data || !isActiveStatus(data.processStatus)) return
    const timer = window.setInterval(() => {
      void refreshProcessStatus()
    }, 3000)
    return () => window.clearInterval(timer)
  }, [data, refreshProcessStatus])

  useEffect(() => {
    const sync = () => {
      const el = previewHostRef.current
      setPreviewFullscreen(!!el && document.fullscreenElement === el)
    }
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const isPdf = data?.canPreview && data.payload.kind === 'pdf'
  const isDocumentLike =
    data?.payload.kind === 'pdf' ||
    data?.payload.kind === 'excel' ||
    data?.payload.kind === 'csv' ||
    data?.payload.kind === 'text' ||
    data?.payload.kind === 'markdown'

  const watermarkText = useMemo(() => {
    if (!data) return ''
    return `中大咨询·${data.viewerName}·${formatWatermarkTime(watermarkTime)}`
  }, [data, watermarkTime])

  const handleDownload = useCallback(async () => {
    if (!data?.canPreview) return
    setDownloading(true)
    try {
      await downloadProjectFile(fileId)
    } catch (e) {
      console.error(e)
      showErrorToast({ title: '下载失败', error: e })
    } finally {
      window.setTimeout(() => setDownloading(false), 600)
    }
  }, [data, fileId])

  const togglePreviewFullscreen = useCallback(async () => {
    const el = previewHostRef.current
    if (!el) return
    try {
      if (document.fullscreenElement === el) {
        const doc = document as Document & {
          webkitExitFullscreen?: () => Promise<void>
        }
        if (document.exitFullscreen) await document.exitFullscreen()
        else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen()
        return
      }
      const anyEl = el as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>
      }
      if (el.requestFullscreen) await el.requestFullscreen()
      else if (anyEl.webkitRequestFullscreen) await anyEl.webkitRequestFullscreen()
      else throw new Error('fullscreen unsupported')
    } catch {
      addToast({
        title: '无法全屏',
        description: '当前浏览器不支持该区域全屏',
        color: 'warning',
      })
    }
  }, [])

  if (loading) return <LoadingPreview />
  if (!data) return <EmptyPreview />

  const statusBusy = refreshing || statusRefreshing

  return (
    <div
      className={`flex ${PREVIEW_PAGE_HEIGHT_CLASS} flex-col overflow-hidden bg-default-50`}
    >
      <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-default-200 bg-background/95 px-2 backdrop-blur-md md:px-4">
        <SubpageBackButton
          variant="light"
          className="shrink-0 px-2"
          href={returnTo}
        />

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="rounded-md border border-default-200 bg-default-100 px-1.5 py-0.5 text-[11px] font-medium text-default-600">
              {previewKindLabel(data)}
            </span>
            <h1 className="min-w-0 truncate text-sm font-semibold text-foreground md:text-base">
              {data.fileName}
            </h1>
            {statusBusy ? (
              <Icon
                icon="lucide:loader-circle"
                className="size-4 shrink-0 animate-spin text-default-400"
                aria-label="刷新中"
              />
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-default-500">
            {formatFileSize(data.fileSize)} · 上传者：{data.uploaderName}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Tooltip content="刷新状态">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              aria-label="刷新状态"
              isLoading={statusBusy}
              onPress={() => void refreshProcessStatus()}
            >
              <Icon icon="lucide:refresh-cw" className="size-4" />
            </Button>
          </Tooltip>
          <div className="mx-1 flex rounded-medium bg-default-100 p-1">
            <Button
              size="sm"
              variant={viewMode === 'preview' ? 'solid' : 'light'}
              color={viewMode === 'preview' ? 'primary' : 'default'}
              className="h-7 px-3"
              onPress={() => setViewMode('preview')}
            >
              文件预览
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'info' ? 'solid' : 'light'}
              color={viewMode === 'info' ? 'primary' : 'default'}
              className="h-7 px-3"
              onPress={() => setViewMode('info')}
            >
              文件信息
            </Button>
          </div>
          {data.canPreview ? (
            <>
              <Tooltip content="下载原文件">
                <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  aria-label="下载原文件"
                  isLoading={downloading}
                  onPress={() => void handleDownload()}
                >
                  <Icon icon="lucide:download" className="size-4" />
                </Button>
              </Tooltip>
              <Tooltip content={previewFullscreen ? '退出全屏' : '全屏预览'}>
                <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  aria-label={previewFullscreen ? '退出全屏' : '全屏预览'}
                  onPress={() => void togglePreviewFullscreen()}
                >
                  <Icon
                    icon={
                      previewFullscreen
                        ? 'lucide:minimize-2'
                        : 'lucide:maximize-2'
                    }
                    className="size-4"
                  />
                </Button>
              </Tooltip>
            </>
          ) : null}
        </div>
      </header>

      <main
        className="min-h-0 flex-1 overflow-hidden p-2 md:p-3 lg:p-4"
      >
        {viewMode === 'preview' ? (
          <section
            ref={previewHostRef}
            className={clsx(
              'flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-default-200 bg-content1 shadow-sm',
              previewFullscreen && 'h-screen w-screen rounded-none border-0'
            )}
          >
            <PreviewProtectedShell
              className={clsx(
                'file-preview-scrollbar relative min-h-0 flex-1 overflow-auto overscroll-contain bg-default-100/70',
                isPdf || isDocumentLike
                  ? 'flex flex-col'
                  : 'flex items-center justify-center p-4'
              )}
            >
              {isPdf || isDocumentLike ? (
                renderPayload(data)
              ) : (
                <div className="flex min-h-full w-full items-center justify-center">
                  {renderPayload(data)}
                </div>
              )}
            </PreviewProtectedShell>
          </section>
        ) : (
          <section className="h-full min-h-0 overflow-hidden rounded-lg border border-default-200 bg-default-50 shadow-sm">
            <FileProcessStatusStrip status={data.processStatus} />
            <FileInfoView
              data={data}
              onSocialUpdate={(patch) =>
                setData((prev) => (prev ? { ...prev, ...patch } : null))
              }
              onTopLevelCommentAdded={(comment) =>
                setData((prev) =>
                  prev
                    ? { ...prev, comments: [...prev.comments, comment] }
                    : null
                )
              }
            />
          </section>
        )}
      </main>
      {data.canPreview && viewMode === 'preview' ? (
        <PreviewWatermark text={watermarkText} anchorRef={previewHostRef} />
      ) : null}
    </div>
  )
}
