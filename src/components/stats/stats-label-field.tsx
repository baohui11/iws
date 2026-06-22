import type { ReactNode } from 'react'

/** 左侧简洁标签 + 右侧控件（用于统计筛选） */
export function StatsLabelField({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2 sm:gap-3 ${className ?? ''}`}
    >
      <span className="w-9 shrink-0 text-xs font-medium text-default-600 sm:w-10">
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
