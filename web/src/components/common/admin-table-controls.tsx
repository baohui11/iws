'use client'

import { Button, Input, Pagination } from '@heroui/react'
import { Icon } from '@iconify/react'
import type { ReactNode } from 'react'

interface AdminTableToolbarProps {
  keyword: string
  onKeywordChange: (value: string) => void
  onSearch: () => void
  searchPlaceholder: string
  isLoading?: boolean
  filters?: ReactNode
  actions?: ReactNode
}

export function AdminTableToolbar({
  keyword,
  onKeywordChange,
  onSearch,
  searchPlaceholder,
  isLoading,
  filters,
  actions,
}: AdminTableToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Input
        placeholder={searchPlaceholder}
        value={keyword}
        onValueChange={onKeywordChange}
        onKeyDown={(e) => e.key === 'Enter' && onSearch()}
        startContent={
          <Icon icon="lucide:search" className="text-default-400 size-4" aria-hidden />
        }
        className="w-64"
        size="sm"
      />
      {filters}
      <Button
        color="primary"
        size="sm"
        onPress={onSearch}
        isLoading={isLoading}
        startContent={
          !isLoading && <Icon icon="lucide:search" className="size-4" aria-hidden />
        }
      >
        搜索
      </Button>
      <div className="flex-1" />
      {actions}
    </div>
  )
}

export function AdminTablePagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (page: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <div className="flex justify-center">
      <Pagination page={page} total={totalPages} onChange={onChange} showControls size="sm" />
    </div>
  )
}

export function AdminTableSummary({
  total,
  page,
  totalPages,
  unit = '条记录',
}: {
  total: number
  page: number
  totalPages: number
  unit?: string
}) {
  return (
    <div className="text-default-400 text-sm">
      共 {total} {unit}
      {totalPages > 1 && `，第 ${page} / ${totalPages} 页`}
    </div>
  )
}
