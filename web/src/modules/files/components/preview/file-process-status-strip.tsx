'use client'

import { Chip } from '@heroui/react'
import { Icon } from '@iconify/react'

const STATUS_LABEL: Record<string, string> = {
  pending: '等待中',
  processing: '处理中',
  ready: '已完成',
  failed: '失败',
  skipped: '跳过',
}

const STATUS_COLOR: Record<
  string,
  'default' | 'primary' | 'success' | 'danger' | 'warning'
> = {
  pending: 'default',
  processing: 'primary',
  ready: 'success',
  failed: 'danger',
  skipped: 'warning',
}

const STAGE_LABEL = {
  preview: '预览',
  parse: '解析',
  index: '索引',
}

export function FileProcessStatusStrip({
  status,
}: {
  status: {
    preview: string | null
    parse: string | null
    index: string | null
  }
}) {
  const items = [
    ['preview', status.preview],
    ['parse', status.parse],
    ['index', status.index],
  ] as const

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map(([stage, value]) => {
        const s = value || 'pending'
        const processing = s === 'processing'
        return (
          <Chip
            key={stage}
            size="sm"
            variant="flat"
            color={STATUS_COLOR[s] ?? 'default'}
            startContent={
              processing ? (
                <Icon
                  icon="lucide:loader-circle"
                  className="size-3 animate-spin"
                  aria-hidden
                />
              ) : undefined
            }
          >
            {STAGE_LABEL[stage]}：{STATUS_LABEL[s] ?? s}
          </Chip>
        )
      })}
    </div>
  )
}
