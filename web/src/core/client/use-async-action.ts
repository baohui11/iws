'use client'

import { useCallback, useState } from 'react'
import { showErrorToast } from '@/core/client/errors'

export function useAsyncAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  options?: {
    errorTitle?: string
    onError?: (error: unknown) => void
  }
) {
  const [isRunning, setIsRunning] = useState(false)

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | null> => {
      setIsRunning(true)
      try {
        return await action(...args)
      } catch (error) {
        options?.onError?.(error)
        showErrorToast({ title: options?.errorTitle, error })
        return null
      } finally {
        setIsRunning(false)
      }
    },
    [action, options]
  )

  return { run, isRunning }
}
