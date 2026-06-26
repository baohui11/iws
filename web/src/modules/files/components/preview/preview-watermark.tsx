'use client'

import { useLayoutEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

type ViewportRect = {
  top: number
  left: number
  width: number
  height: number
}

const ROW_HEIGHT_PX = 96
const WATERMARK_ROWS = 12
const WATERMARK_COLS = 3

function clampRectToViewport(box: DOMRect): ViewportRect | null {
  const top = Math.max(box.top, 0)
  const left = Math.max(box.left, 0)
  const width = Math.min(box.right, window.innerWidth) - left
  const height = Math.min(box.bottom, window.innerHeight) - top
  if (width <= 0 || height <= 0) return null
  return { top, left, width, height }
}

/**
 * 用 fixed + Portal 钉在预览面板可见区域上，不随 PDF 内容或页面滚动离开视口。
 */
export function PreviewWatermark({
  text,
  anchorRef,
}: {
  text: string
  anchorRef: React.RefObject<HTMLElement | null>
}) {
  const [rect, setRect] = useState<ViewportRect | null>(null)
  const tiles = useMemo(
    () => Array.from({ length: WATERMARK_ROWS * WATERMARK_COLS }, (_, i) => i),
    []
  )

  useLayoutEffect(() => {
    const anchor = anchorRef.current
    if (!anchor) return

    const sync = () => {
      const next = clampRectToViewport(anchor.getBoundingClientRect())
      setRect(next)
    }

    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(anchor)
    window.addEventListener('scroll', sync, true)
    window.addEventListener('resize', sync)

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', sync, true)
      window.removeEventListener('resize', sync)
    }
  }, [anchorRef])

  if (!rect || rect.width <= 0 || rect.height <= 0) return null

  return createPortal(
    <div
      aria-hidden
      className="pointer-events-none fixed z-[38] overflow-hidden"
      style={{
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      }}
    >
      <div
        className="grid h-full w-full grid-cols-2 content-start gap-x-20 gap-y-8 p-8 sm:grid-cols-3"
        style={{ gridAutoRows: `${ROW_HEIGHT_PX}px` }}
      >
        {tiles.map((tile) => (
          <span
            key={tile}
            className="-rotate-24 select-none whitespace-nowrap text-[13px] font-medium leading-none text-gray-600/24 dark:text-gray-300/20"
          >
            {text}
          </span>
        ))}
      </div>
    </div>,
    document.body
  )
}
