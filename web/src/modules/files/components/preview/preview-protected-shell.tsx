'use client'

import type { ReactNode } from 'react'

/**
 * 尽量降低另存/右键复制体验（无法完全防止截屏或开发者工具）
 */
export function PreviewProtectedShell({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`relative select-none ${className}`}
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {children}
    </div>
  )
}
