'use server'

import { run } from '@/core/result'
import * as svc from './service'

export async function loadFilePreview(fileId: string) {
  return run(() => svc.loadFilePreview(fileId))
}
