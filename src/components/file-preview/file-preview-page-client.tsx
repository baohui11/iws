'use client'

import { Card, CardBody, Divider, Spinner, addToast, Button } from '@heroui/react'
import { Icon } from '@iconify/react'
import dynamic from 'next/dynamic'
import { SubpageBackButton } from '@/components/common/subpage-header'
import clsx from 'clsx'
import { useCallback, useEffect, useRef, useState } from 'react'
import { loadFilePreview } from '@/actions/files/file-preview.action'
import type { FilePreviewLoadResult } from '@/types/file-preview'
import { formatFileSize } from '@/lib/utils/format-file-size'
import { PreviewProtectedShell } from '@/components/file-preview/preview-protected-shell'
import { PreviewCsv } from '@/components/file-preview/renderers/preview-csv'
import { PreviewExcel } from '@/components/file-preview/renderers/preview-excel'
import { PreviewImage } from '@/components/file-preview/renderers/preview-image'
import { PreviewMarkdown } from '@/components/file-preview/renderers/preview-markdown'
import { PreviewMedia } from '@/components/file-preview/renderers/preview-media'
import { PreviewText } from '@/components/file-preview/renderers/preview-text'
import { PreviewUnsupported } from '@/components/file-preview/renderers/preview-unsupported'
import FilePreviewInteractionPanel from '@/components/file-preview/file-preview-interaction-panel'

const PreviewPdf = dynamic(
  () => import('./renderers/preview-pdf').then((m) => m.PreviewPdf),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[240px] flex-1 items-center justify-center py-16">
        <Spinner label="加载 PDF 引擎…" />
      </div>
    ),
  }
)

function renderPayload(data: FilePreviewLoadResult) {
  const { payload } = data
  switch (payload.kind) {
    case 'text':
      return <PreviewText text={payload.text} />
    case 'csv':
      return (
        <PreviewCsv rows={payload.rows} truncated={payload.truncated} />
      )
    case 'markdown':
      return <PreviewMarkdown text={payload.text} />
    case 'image':
      return <PreviewImage signedUrl={payload.signedUrl} />
    case 'pdf':
      return <PreviewPdf signedUrl={payload.signedUrl} />
    case 'media':
      return (
        <PreviewMedia signedUrl={payload.signedUrl} media={payload.media} />
      )
    case 'excel':
      return <PreviewExcel data={payload.data} />
    case 'unsupported':
      return <PreviewUnsupported message={payload.message} />
    default:
      return <PreviewUnsupported message="暂不支持预览" />
  }
}

export default function FilePreviewPageClient({ fileId }: { fileId: string }) {
  const [data, setData] = useState<FilePreviewLoadResult | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await loadFilePreview(fileId)
    setLoading(false)
    if (!res.success || !res.data) {
      addToast({
        title: '无法预览',
        description: res.message ?? '加载失败',
        color: 'danger',
      })
      setData(null)
      return
    }
    setData(res.data)
  }, [fileId])

  useEffect(() => {
    void load()
  }, [load])

  const isPdf =
    !!data?.canPreview && data?.payload.kind === 'pdf'

  const previewHostRef = useRef<HTMLDivElement>(null)
  const [previewFullscreen, setPreviewFullscreen] = useState(false)

  useEffect(() => {
    const sync = () => {
      const el = previewHostRef.current
      setPreviewFullscreen(!!el && document.fullscreenElement === el)
    }
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const [downloading, setDownloading] = useState(false)

  const handleDownload = useCallback(async () => {
    if (!data?.canPreview) return
    setDownloading(true)
    try {
      const res = await fetch(`/api/files/${encodeURIComponent(fileId)}/download`)
      if (!res.ok) {
        let msg = '下载失败'
        try {
          const j = (await res.json()) as { message?: string }
          if (j?.message) msg = j.message
        } catch {
          /* ignore */
        }
        addToast({ title: msg, color: 'danger' })
        return
      }
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition')
      let name = data.fileName
      const m = cd?.match(/filename\*=UTF-8''([^;\s]+)/i)
      if (m?.[1]) {
        try {
          name = decodeURIComponent(m[1])
        } catch {
          /* ignore */
        }
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      addToast({
        title: '下载失败',
        description: '请稍后重试',
        color: 'danger',
      })
    } finally {
      setDownloading(false)
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
      if (el.requestFullscreen) {
        await el.requestFullscreen()
      } else if (anyEl.webkitRequestFullscreen) {
        await anyEl.webkitRequestFullscreen()
      } else {
        throw new Error('unsupported')
      }
    } catch {
      addToast({
        title: '无法全屏',
        description: '当前浏览器不支持或将该区域全屏显示',
        color: 'warning',
      })
    }
  }, [])

  return (
    <div className="relative flex min-h-screen flex-1 flex-col bg-default-50">
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-3 py-2 md:px-5 md:py-3">
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-24">
            <Spinner label="加载预览…" />
          </div>
        ) : data ? (
          <Card
            shadow="sm"
            className="flex min-h-0 flex-1 flex-col overflow-hidden border border-default-200/90 bg-content1"
          >
            <CardBody className="flex min-h-0 flex-1 flex-col gap-0 p-0">
              <div className="flex shrink-0 flex-col gap-1 border-b border-default-200/80 px-3 py-1.5 md:px-4">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <SubpageBackButton
                    variant="light"
                    className="-ms-2 min-w-0 px-2"
                  />
                  <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="shrink-0 text-xs text-default-500">
                      文件预览
                    </span>
                    <span className="text-default-300" aria-hidden>
                      ·
                    </span>
                    <h1 className="min-w-0 max-w-full truncate text-sm font-semibold text-foreground md:text-base">
                      {data.fileName}
                    </h1>
                    <span className="text-xs text-default-500">
                      {formatFileSize(data.fileSize)}
                      {data.fileExt ? ` · .${data.fileExt}` : ''}
                    </span>
                  </div>
                  {data.canPreview ? (
                    <>
                      <Button
                        variant="flat"
                        size="sm"
                        className="shrink-0"
                        isLoading={downloading}
                        startContent={
                          !downloading ? (
                            <Icon icon="lucide:download" className="size-4" aria-hidden />
                          ) : null
                        }
                        onPress={() => void handleDownload()}
                      >
                        下载
                      </Button>
                      <Button
                        isIconOnly
                        variant="flat"
                        size="sm"
                        className="shrink-0"
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
                          aria-hidden
                        />
                      </Button>
                    </>
                  ) : null}
                </div>
                <p className="text-xs text-default-600">
                  上传者：{data.uploaderName}
                </p>
              </div>

              {/* 灰底与文件贴齐无内边距；默认 16:9；外圈仅保留与卡片边的细间距 */}
              <div className="min-w-0 flex-1 px-2 pb-2 pt-0 md:px-3 md:pb-3">
                <div
                  ref={previewHostRef}
                  className={clsx(
                    'flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg bg-default-100/90',
                    previewFullscreen
                      ? 'h-full w-full flex-1 rounded-none bg-default-100'
                      : data.canPreview
                        ? 'aspect-video w-full max-h-[92svh]'
                        : 'min-h-[240px] w-full'
                  )}
                >
                  <PreviewProtectedShell
                    className={
                      isPdf
                        ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
                        : 'flex min-h-0 flex-1 flex-col overflow-auto'
                    }
                  >
                    {isPdf ? (
                      renderPayload(data)
                    ) : (
                      <div className="flex min-h-full min-w-0 flex-1 items-center justify-center">
                        <div className="w-full max-w-full">
                          {renderPayload(data)}
                        </div>
                      </div>
                    )}
                  </PreviewProtectedShell>
                </div>
              </div>

              {data.canPreview ? (
                <>
                  <Divider />
                  <FilePreviewInteractionPanel
                    fileId={data.fileId}
                    favorite={data.interactions.favorite}
                    recommend={data.interactions.recommend}
                    recommendStats={data.recommendStats}
                    topLevelComments={data.comments}
                    onSocialUpdate={(patch) =>
                      setData((d) => (d ? { ...d, ...patch } : null))
                    }
                    onTopLevelCommentAdded={(comment) =>
                      setData((d) =>
                        d ? { ...d, comments: [...d.comments, comment] } : null
                      )
                    }
                  />
                </>
              ) : null}
            </CardBody>
          </Card>
        ) : (
          <Card
            shadow="sm"
            className="border border-default-200/90 bg-content1"
          >
            <CardBody className="py-12 text-center text-sm text-default-500">
              无法加载预览
            </CardBody>
          </Card>
        )}
      </main>
    </div>
  )
}
