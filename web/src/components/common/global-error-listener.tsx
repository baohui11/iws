'use client'

import { useEffect } from 'react'
import { showErrorToast } from '@/core/client/errors'

function shouldIgnoreGlobalError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  return (
    message.includes('ResizeObserver loop') ||
    message.includes('The operation was aborted')
  )
}

export function GlobalErrorListener() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const error = event.error ?? event.message
      if (shouldIgnoreGlobalError(error)) return
      console.error('[client error]', error)
      showErrorToast({
        title: '页面运行异常',
        error,
        fallbackMessage: '页面出现异常，请刷新后重试',
      })
    }

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason
      if (shouldIgnoreGlobalError(error)) return
      console.error('[unhandled rejection]', error)
      showErrorToast({
        title: '操作失败',
        error,
        fallbackMessage: '操作失败，请稍后重试',
      })
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  }, [])

  return null
}
