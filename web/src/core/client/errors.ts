'use client'

import { addToast } from '@heroui/react'
import type { Result } from '@/core/result'

const DEFAULT_ERROR_TITLE = '操作失败'
const DEFAULT_ERROR_MESSAGE = '操作失败，请稍后重试'

let lastToastKey = ''
let lastToastAt = 0

function shouldSuppressDuplicate(title: string, message: string): boolean {
  const now = Date.now()
  const key = `${title}\n${message}`
  if (key === lastToastKey && now - lastToastAt < 1500) return true
  lastToastKey = key
  lastToastAt = now
  return false
}

export function errorMessageOf(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return DEFAULT_ERROR_MESSAGE
}

export function showErrorToast(params: {
  title?: string
  message?: string
  error?: unknown
  fallbackMessage?: string
}): void {
  const title = params.title ?? DEFAULT_ERROR_TITLE
  const message =
    params.message ??
    (params.error == null
      ? (params.fallbackMessage ?? DEFAULT_ERROR_MESSAGE)
      : errorMessageOf(params.error))

  if (shouldSuppressDuplicate(title, message)) return

  addToast({
    title,
    description: message,
    color: 'danger',
  })
}

export function showResultError<T>(
  result: Result<T>,
  title = DEFAULT_ERROR_TITLE
): boolean {
  if (result.success) return false
  showErrorToast({ title, message: result.message })
  return true
}

export function unwrapResultOrToast<T>(
  result: Result<T>,
  title = DEFAULT_ERROR_TITLE
): T | null {
  if (result.success) return result.data
  showErrorToast({ title, message: result.message })
  return null
}

export async function runWithErrorToast<T>(
  fn: () => Promise<T>,
  title = DEFAULT_ERROR_TITLE
): Promise<T | null> {
  try {
    return await fn()
  } catch (error) {
    showErrorToast({ title, error })
    return null
  }
}
