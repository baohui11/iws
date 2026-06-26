'use client'

import { forwardRef, type ReactNode } from 'react'

/**
 * 尽量降低另存/右键复制体验（无法完全防止截屏或开发者工具）
 */
export const PreviewProtectedShell = forwardRef<
  HTMLDivElement,
  {
    children: ReactNode
    className?: string
  }
>(function PreviewProtectedShell({ children, className = '' }, ref) {
  return (
    <div
      ref={ref}
      className={`relative select-none ${className}`}
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {children}
    </div>
  )
})
