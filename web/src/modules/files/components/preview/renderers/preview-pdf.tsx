'use client'

import { Button, Input, Spinner } from '@heroui/react'
import { Icon } from '@iconify/react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'

/** cancel() 后 promise 会 reject，不应当作「渲染失败」展示 */
function isPdfRenderCancelled(e: unknown): boolean {
  if (e == null || typeof e !== 'object') return false
  const name = (e as Error).name
  return (
    name === 'RenderingCancelledException' ||
    name === 'AbortException' ||
    (typeof name === 'string' && name.includes('Cancelled'))
  )
}

/** 按 PDF 页面原始尺寸渲染（scale=1，与 PDF 坐标系一致，不做额外缩放） */
function PdfPageCanvas({
  pdf,
  pageNumber,
}: {
  pdf: PDFDocumentProxy
  pageNumber: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null)
  const renderGenRef = useRef(0)
  const [renderErr, setRenderErr] = useState<string | null>(null)

  /**
   * useLayoutEffect：ref 在 DOM 提交后已可用；卸载/重跑时 cancel 会 reject，需忽略；
   * renderGenRef 防止 Strict Mode 下旧异步晚到仍 setRenderErr。
   */
  useLayoutEffect(() => {
    const gen = ++renderGenRef.current
    let cancelled = false
    let rafId = 0
    let attempts = 0
    const maxRefRetries = 5

    // 每次重渲染前清错误态，配合 pdf.js 命令式 canvas 渲染（外部系统同步）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRenderErr(null)

    async function renderOnce() {
      const c = canvasRef.current
      if (!c) {
        if (attempts < maxRefRetries && !cancelled) {
          attempts += 1
          rafId = requestAnimationFrame(() => {
            if (!cancelled) void renderOnce()
          })
        }
        return
      }

      renderTaskRef.current?.cancel()
      renderTaskRef.current = null

      try {
        const page = await pdf.getPage(pageNumber)
        if (cancelled || gen !== renderGenRef.current) return

        const viewport = page.getViewport({ scale: 1 })
        const w = Math.max(1, Math.floor(viewport.width))
        const h = Math.max(1, Math.floor(viewport.height))
        c.width = w
        c.height = h
        const ctx = c.getContext('2d')
        if (!ctx) {
          if (!cancelled && gen === renderGenRef.current) {
            setRenderErr('该页渲染失败')
          }
          return
        }

        const task = page.render({ canvasContext: ctx, viewport })
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
      cancelAnimationFrame(rafId)
      renderTaskRef.current?.cancel()
      renderTaskRef.current = null
    }
  }, [pdf, pageNumber])

  /** 始终保留 canvas，避免出错时用 p 替换导致 ref 丢失、后续无法重绘 */
  return (
    <div className="mx-auto inline-block max-w-none">
      <canvas
        ref={canvasRef}
        className="block max-w-none bg-white shadow-none ring-1 ring-default-200/40"
      />
      {renderErr ? (
        <p className="mt-2 text-center text-sm text-danger">{renderErr}</p>
      ) : null}
    </div>
  )
}

export function PreviewPdf({ signedUrl }: { signedUrl: string }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      setPdf(null)
      setNumPages(0)
      setCurrentPage(1)
      setPageInput('1')
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
        const task = pdfjs.getDocument({ url: signedUrl })
        const doc = await task.promise
        if (cancelled) return
        setPdf(doc)
        setNumPages(doc.numPages)
        setCurrentPage(1)
        setPageInput('1')
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

  const goToPage = useCallback(
    (p: number) => {
      if (!numPages) return
      const next = Math.max(1, Math.min(Math.floor(p), numPages))
      setCurrentPage(next)
      setPageInput(String(next))
    },
    [numPages]
  )

  const onPrevNext = useCallback(
    (delta: number) => {
      goToPage(currentPage + delta)
    },
    [currentPage, goToPage]
  )

  const onJump = useCallback(() => {
    const n = parseInt(pageInput.trim(), 10)
    if (!Number.isFinite(n)) return
    goToPage(n)
  }, [goToPage, pageInput])

  const showPager = !!(pdf && numPages > 0 && !loading && !error)

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        {loading ? (
          <div className="flex w-full flex-1 items-center justify-center py-10">
            <Spinner label="加载 PDF…" />
          </div>
        ) : error ? (
          <p className="m-auto w-full px-3 text-center text-sm text-danger">
            {error}
          </p>
        ) : pdf && numPages > 0 ? (
          <div className="flex min-h-full w-full flex-col items-center px-0 pb-3 pt-11">
            <div className="flex w-max max-w-full flex-col items-center">
              <PdfPageCanvas pdf={pdf} pageNumber={currentPage} />
            </div>
          </div>
        ) : null}
      </div>

      {showPager ? (
        <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex justify-center px-2">
          <div
            className="pointer-events-auto flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-default-200/25 bg-background/40 px-2.5 py-1 shadow-sm backdrop-blur-md"
            role="toolbar"
            aria-label="PDF 翻页"
          >
            <div className="flex items-center gap-0.5">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                className="bg-transparent"
                aria-label="上一页"
                isDisabled={currentPage <= 1}
                onPress={() => onPrevNext(-1)}
              >
                <Icon icon="lucide:chevron-left" className="size-4" />
              </Button>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                className="bg-transparent"
                aria-label="下一页"
                isDisabled={currentPage >= numPages}
                onPress={() => onPrevNext(1)}
              >
                <Icon icon="lucide:chevron-right" className="size-4" />
              </Button>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="whitespace-nowrap text-xs text-default-600">
                第
              </span>
              <Input
                size="sm"
                type="number"
                min={1}
                max={numPages || 1}
                value={pageInput}
                onValueChange={setPageInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onJump()
                }}
                classNames={{
                  input: 'text-center tabular-nums',
                  inputWrapper:
                    'h-8 w-14 min-w-14 bg-transparent shadow-none',
                }}
                isDisabled={numPages === 0}
              />
              <span className="whitespace-nowrap text-xs text-default-600">
                / {numPages} 页
              </span>
              <Button
                size="sm"
                color="primary"
                variant="flat"
                className="bg-primary/20"
                isDisabled={numPages === 0}
                onPress={onJump}
              >
                跳转
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
