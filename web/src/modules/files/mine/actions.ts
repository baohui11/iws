'use server'

import { run } from '@/core/result'
import * as svc from './service'

export async function loadMineFilesPageAction(input: {
  offset: number
  fileNameQuery?: string | null
  projectId?: string | null
  projectStage?: string | null
}) {
  return run(() => svc.loadMineFilesPage(input))
}
