import { requireUser } from '@/core/auth'
import { ValidationError } from '@/core/errors'
import { getFileRowForPreview } from '@/modules/files/preview/repo'
import { canAccessFileBinary } from '@/modules/files/preview/access'
import * as repo from './repo'
import type { FileProcessStatusView } from './types'

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

export async function enqueueInitialProcessingForFile(fileId: string): Promise<void> {
  await repo.enqueueInitialFileProcessTasks({
    fileId,
    previewInput: { version: 1 },
    parseInput: { version: 1 },
  })
}

export async function loadFileProcessStatus(fileId: string): Promise<{
  fileId: string
  tasks: FileProcessStatusView[]
}> {
  const user = await requireUser()
  const id = fileId?.trim()
  if (!id) throw new ValidationError('文件 ID 无效')

  const row = await getFileRowForPreview(id)
  if (!row) throw new ValidationError('文件不存在')
  if (!canAccessFileBinary(user, row)) {
    throw new ValidationError('无权查看该文件处理状态')
  }

  const rows = await repo.listFileProcessTasks(id)
  return {
    fileId: id,
    tasks: rows.map((r) => ({
      stage: r.stage,
      status: r.status,
      attempts: r.attempts,
      maxAttempts: r.max_attempts,
      errorCode: r.error_code,
      errorMessage: r.error_message,
      startedAt: toIso(r.started_at),
      completedAt: toIso(r.completed_at),
      updatedAt: toIso(r.updated_at),
    })),
  }
}
