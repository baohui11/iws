'use client'

import { useEffect } from 'react'
import { Button } from '@heroui/react'

function isDeploymentMismatch(error: Error & { digest?: string }): boolean {
  const msg = error?.message ?? ''
  return (
    msg.includes('Failed to find Server Action') ||
    msg.includes('NEXT_DEPLOYMENT') ||
    msg.includes('This request might be from an older')
  )
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (isDeploymentMismatch(error)) {
      window.location.reload()
    }
  }, [error])

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <p className="text-lg font-medium text-danger">页面发生错误</p>
      <p className="text-sm text-default-500 max-w-sm text-center">
        {isDeploymentMismatch(error)
          ? '检测到版本更新，正在自动刷新页面…'
          : (error?.message ?? '未知错误，请刷新重试')}
      </p>
      {!isDeploymentMismatch(error) && (
        <div className="flex gap-2">
          <Button size="sm" variant="flat" onPress={reset}>
            重试
          </Button>
          <Button size="sm" variant="flat" onPress={() => window.location.reload()}>
            刷新页面
          </Button>
        </div>
      )}
    </div>
  )
}
