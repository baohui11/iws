'use server'

import { run } from '@/core/result'
import * as svc from './service'
import type { FilesMineTab } from '../types'

export async function loadMineFilesPageAction(input: {
  tab: FilesMineTab
  offset: number
  fileNameQuery?: string | null
}) {
  return run(() => svc.loadMineFilesPage(input))
}
