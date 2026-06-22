'use client'

import { Icon } from '@iconify/react'

export function PreviewUnsupported({ message }: { message: string }) {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-3 py-12 text-center">
      <Icon
        icon="lucide:file-question"
        className="size-14 text-default-400"
        aria-hidden
      />
      <p className="max-w-md text-sm text-default-600">{message}</p>
    </div>
  )
}
