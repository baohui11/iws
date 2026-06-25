'use server'

import { run } from '@/core/result'
import * as svc from './service'
import type { ListProjectFilesFilters } from '../types'

export async function loadProjectFilesPage(
  projectId: string,
  filters: ListProjectFilesFilters,
  offset: number,
  limit: number
) {
  return run(() =>
    svc.loadProjectFilesPage(projectId, filters, offset, limit)
  )
}
