'use client'

import { Button, Divider, Input, Spinner, Tooltip } from '@heroui/react'
import { Icon } from '@iconify/react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'

const MIN_ZOOM = 0.5
const DEFAULT_ZOOM = 0.8
const MAX_ZOOM = 2.5
const ZOOM_STEP = 0.1
const MAX_RENDER_DPR = 2
const PAGE_GAP = 40

function isPdfRenderCancelled(e: unknown): boolean {
  if (e == null || typeof e !== 'object') return false
  const name = (e as Error).name
  return (
    name === 'RenderingCancelledException' ||
    name === 'AbortException' ||
    (typeof name === 'string' && name.includes('Cancelled'))
  )
}

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

function useElementWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const sync = () => setWidth(el.clientWidth)
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])

  return width
}

function PdfPageCanvas({
  pdf,
  pageNumber,
  zoom,
  containerWidth,
}: {
  pdf: PDFDocumentProxy
  pageNumber: number
  zoom: number
  containerWidth: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null)
  const renderGenRef = useRef(0)
  const [renderErr, setRenderErr] = useState<string | null>(null)

  useLayoutEffect(() => {
    const gen = ++renderGenRef.current
    let cancelled = false

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRenderErr(null)

    async function renderOnce() {
      const canvas = canvasRef.current
      if (!canvas) return

      renderTaskRef.current?.cancel()
      renderTaskRef.current = null

      try {
        const page = await pdf.getPage(pageNumber)
        if (cancelled || gen !== renderGenRef.current) return

        const baseViewport = page.getViewport({ scale: 1 })
        const availableWidth = Math.max(320, containerWidth - PAGE_GAP)
        const fitScale =
          baseViewport.width > 0
            ? Math.min(1.8, availableWidth / baseViewport.width)
            : 1
        const cssScale = fitScale * zoom
        const renderDpr = Math.min(
          MAX_RENDER_DPR,
          Math.max(1, window.devicePixelRatio || 1)
        )
        const renderViewport = page.getViewport({
          scale: cssScale * renderDpr,
        })
        const cssViewport = page.getViewport({ scale: cssScale })

        canvas.width = Math.max(1, Math.floor(renderViewport.width))
        canvas.height = Math.max(1, Math.floor(renderViewport.height))
        canvas.style.width = `${Math.max(1, Math.floor(cssViewport.width))}px`
        canvas.style.height = `${Math.max(1, Math.floor(cssViewport.height))}px`

        const ctx = canvas.getContext('2d', { alpha: false })
        if (!ctx) {
          setRenderErr('该页渲染失败')
          return
        }
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'

        const task = page.render({
          canvasContext: ctx,
          viewport: renderViewport,
        })
        renderTaskRef.current = task
        try {
          await task.promise
        } catch (e) {
          if (cancelled || gen !== renderGenRef.current) return
          if (isPdfRenderCancelled(e)) return
          setRenderErr('该页渲染失败')
          return
        }

        if (cancelled || gen !== renderGenRef.current) return
        setRenderErr(null)
      } catch (e) {
        if (cancelled || gen !== renderGenRef.current) return
        if (isPdfRenderCancelled(e)) return
        setRenderErr('该页渲染失败')
      }
    }

    void renderOnce()

    return () => {
      cancelled = true
      renderTaskRef.current?.cancel()
      renderTaskRef.current = null
    }
  }, [containerWidth, pdf, pageNumber, zoom])

  return (
    <section
      id={`pdf-page-${pageNumber}`}
      className="flex scroll-mt-16 flex-col items-center gap-2"
    >
      <canvas
        ref={canvasRef}
        className="block max-w-none bg-white shadow-sm ring-1 ring-default-200"
      />
      <span className="text-xs text-default-400">第 {pageNumber} 页</span>
      {renderErr ? (
        <p className="text-center text-sm text-danger">{renderErr}</p>
      ) : null}
    </section>
  )
}

export function PreviewPdf({ signedUrl }: { signedUrl: string }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const containerWidth = useElementWidth(viewportRef)
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [pageInput, setPageInput] = useState('1')
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [toolbarOpen, setToolbarOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      setPdf(null)
      setNumPages(0)
      setPageInput('1')
      setZoom(DEFAULT_ZOOM)
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
        const task = pdfjs.getDocument({ url: signedUrl })
        const doc = await task.promise
        if (cancelled) return
        setPdf(doc)
        setNumPages(doc.numPages)
      } catch {
        setError('PDF 加载失败，请稍后重试')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [signedUrl])

  const jumpToPage = useCallback(() => {
    const n = parseInt(pageInput.trim(), 10)
    if (!Number.isFinite(n) || !numPages) return
    const page = Math.max(1, Math.min(Math.floor(n), numPages))
    setPageInput(String(page))
    document
      .getElementById(`pdf-page-${page}`)
      ?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [numPages, pageInput])

  const setZoomBy = useCallback((delta: number) => {
    setZoom((z) => clampZoom(Number((z + delta).toFixed(2))))
  }, [])

  const showToolbar = !!(pdf && numPages > 0 && !loading && !error)

  return (
    <div className="relative flex w-full flex-col">
      <div ref={viewportRef} className="min-w-0 bg-default-100">
        {loading ? (
          <div className="flex min-h-full w-full items-center justify-center py-10">
            <Spinner label="加载 PDF" />
          </div>
        ) : error ? (
          <p className="m-auto w-full px-3 py-10 text-center text-sm text-danger">
            {error}
          </p>
        ) : pdf && numPages > 0 && containerWidth > 0 ? (
          <div className="flex min-h-full w-full flex-col items-center gap-8 px-4 pb-8 pt-14">
            {Array.from({ length: numPages }, (_, index) => (
              <PdfPageCanvas
                key={index + 1}
                pdf={pdf}
                pageNumber={index + 1}
                zoom={zoom}
                containerWidth={containerWidth}
              />
            ))}
          </div>
        ) : null}
      </div>

      {showToolbar ? (
        <div className="pointer-events-none absolute inset-x-0 top-2 z-50 flex justify-center px-2">
          {toolbarOpen ? (
            <div
              className="pointer-events-auto flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-default-200/70 bg-background/85 px-2 py-1 shadow-sm backdrop-blur-md"
              role="toolbar"
              aria-label="PDF 工具栏"
            >
              <div className="flex items-center gap-1.5">
                <Input
                  size="sm"
                  type="number"
                  min={1}
                  max={numPages || 1}
                  value={pageInput}
                  onValueChange={setPageInput}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') jumpToPage()
                  }}
                  classNames={{
                    input: 'text-center tabular-nums',
                    inputWrapper:
                      'h-8 w-14 min-w-14 bg-transparent shadow-none',
                  }}
                  aria-label="页码"
                />
                <span className="whitespace-nowrap text-xs text-default-600">
                  / {numPages}
                </span>
                <Button
                  size="sm"
                  color="primary"
                  variant="flat"
                  className="bg-primary/15"
                  onPress={jumpToPage}
                >
                  跳转
                </Button>
              </div>

              <Divider orientation="vertical" className="h-5" />

              <div className="flex items-center gap-0.5">
                <Tooltip content="缩小">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    aria-label="缩小"
                    isDisabled={zoom <= MIN_ZOOM}
                    onPress={() => setZoomBy(-ZOOM_STEP)}
                  >
                    <Icon icon="lucide:zoom-out" className="size-4" />
                  </Button>
                </Tooltip>
                <button
                  type="button"
                  className="min-w-12 rounded-md px-1.5 py-1 text-center text-xs tabular-nums text-default-600 hover:bg-default-100"
                  onClick={() => setZoom(DEFAULT_ZOOM)}
                >
                  {Math.round(zoom * 100)}%
                </button>
                <Tooltip content="放大">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    aria-label="放大"
                    isDisabled={zoom >= MAX_ZOOM}
                    onPress={() => setZoomBy(ZOOM_STEP)}
                  >
                    <Icon icon="lucide:zoom-in" className="size-4" />
                  </Button>
                </Tooltip>
              </div>

              <Tooltip content="收起工具栏">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  aria-label="收起工具栏"
                  onPress={() => setToolbarOpen(false)}
                >
                  <Icon icon="lucide:chevron-up" className="size-4" />
                </Button>
              </Tooltip>
            </div>
          ) : (
            <Tooltip content="展开 PDF 工具栏">
              <Button
                isIconOnly
                size="sm"
                variant="flat"
                className="pointer-events-auto bg-background/85 shadow-sm backdrop-blur-md"
                aria-label="展开 PDF 工具栏"
                onPress={() => setToolbarOpen(true)}
              >
                <Icon icon="lucide:panel-top-open" className="size-4" />
              </Button>
            </Tooltip>
          )}
        </div>
      ) : null}
    </div>
  )
}
