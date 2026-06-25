'use server'

import { run } from '@/core/result'
import * as svc from './service'

export async function searchDocumentsAction(input: {
  q?: string
  limit?: number
  offset?: number
  filters?: Record<string, unknown>
  crop_length?: number
  max_content_chars?: number
}) {
  return run(() => svc.searchDocuments(input))
}
