'use client'

import { Button } from '@heroui/react'
import { Icon } from '@iconify/react'
import { useEffect } from 'react'
import { showErrorToast } from '@/core/client/errors'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app error boundary]', error)
    showErrorToast({
      title: '页面加载失败',
      error,
      fallbackMessage: '页面加载失败，请重试',
    })
  }, [error])

  return (
    <div className="flex min-h-[calc(100svh-60px)] items-center justify-center bg-default-50 p-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <div className="rounded-full bg-danger/10 p-3 text-danger">
          <Icon icon="lucide:triangle-alert" className="size-8" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-foreground">页面加载失败</h1>
          <p className="text-sm text-default-500">
            当前页面出现异常，请重试；如果持续出现，请联系管理员。
          </p>
        </div>
        <Button color="primary" variant="flat" onPress={reset}>
          重试
        </Button>
      </div>
    </div>
  )
}
