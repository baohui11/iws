'use server'

import { run } from '@/core/result'
import { loadFileProcessStatus } from './service'

export async function loadFileProcessStatusAction(fileId: string) {
  return run(() => loadFileProcessStatus(fileId))
}
