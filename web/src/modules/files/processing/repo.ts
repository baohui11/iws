import { and, asc, desc, eq, inArray, lte, or, isNull } from 'drizzle-orm'
import { getDb } from '@/core/db/client'
import { fileProcessTasks, files } from '@/core/db/schema'
import { pgmqQueue } from '@/core/queue/pgmq'
import type { Json } from '@/types/json'
import {
  FILE_PROCESSING_QUEUE,
  type FileProcessQueuePayload,
  type FileProcessStage,
  type FilePipelineStatus,
} from './types'

function isFileProcessStage(value: unknown): value is FileProcessStage {
  return value === 'preview' || value === 'parse' || value === 'index'
}

function isFileProcessQueuePayload(
  value: unknown
): value is FileProcessQueuePayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as Partial<FileProcessQueuePayload>
  return (
    payload.version === 1 &&
    typeof payload.taskId === 'string' &&
    typeof payload.fileId === 'string' &&
    isFileProcessStage(payload.stage)
  )
}

async function publishTaskMessage(input: {
  taskId: string
  fileId: string
  stage: FileProcessStage
}): Promise<void> {
  const msgId = await pgmqQueue.enqueue<FileProcessQueuePayload>(
    FILE_PROCESSING_QUEUE,
    {
      version: 1,
      taskId: input.taskId,
      fileId: input.fileId,
      stage: input.stage,
    }
  )
  const pgmqMessageId = Number(msgId)
  if (!Number.isSafeInteger(pgmqMessageId)) {
    throw new Error(`Invalid pgmq message id: ${msgId}`)
  }

  await getDb()
    .update(fileProcessTasks)
    .set({ pgmqMessageId, updatedAt: new Date() })
    .where(eq(fileProcessTasks.id, input.taskId))
}

export async function enqueueInitialFileProcessTasks(input: {
  fileId: string
  previewInput?: Json
  parseInput?: Json
}): Promise<void> {
  const db = getDb()
  const rows = await db
    .insert(fileProcessTasks)
    .values([
      {
        fileId: input.fileId,
        stage: 'preview',
        status: 'pending',
        input: input.previewInput,
      },
      {
        fileId: input.fileId,
        stage: 'parse',
        status: 'pending',
        input: input.parseInput,
      },
    ])
    .onConflictDoNothing()
    .returning({
      id: fileProcessTasks.id,
      fileId: fileProcessTasks.fileId,
      stage: fileProcessTasks.stage,
    })

  await Promise.all(
    rows.map((row) =>
      publishTaskMessage({
        taskId: row.id,
        fileId: row.fileId,
        stage: row.stage,
      })
    )
  )
}

export async function enqueueIndexTask(fileId: string, input?: Json): Promise<void> {
  const db = getDb()
  const rows = await db
    .insert(fileProcessTasks)
    .values({
      fileId,
      stage: 'index',
      status: 'pending',
      input,
    })
    .onConflictDoNothing()
    .returning({
      id: fileProcessTasks.id,
      fileId: fileProcessTasks.fileId,
      stage: fileProcessTasks.stage,
    })

  await Promise.all(
    rows.map((row) =>
      publishTaskMessage({
        taskId: row.id,
        fileId: row.fileId,
        stage: row.stage,
      })
    )
  )
}

export async function listFileProcessTasks(fileId: string) {
  const db = getDb()
  return db
    .select({
      stage: fileProcessTasks.stage,
      status: fileProcessTasks.status,
      attempts: fileProcessTasks.attempts,
      max_attempts: fileProcessTasks.maxAttempts,
      error_code: fileProcessTasks.errorCode,
      error_message: fileProcessTasks.errorMsg,
      started_at: fileProcessTasks.startedAt,
      completed_at: fileProcessTasks.completedAt,
      updated_at: fileProcessTasks.updatedAt,
    })
    .from(fileProcessTasks)
    .where(eq(fileProcessTasks.fileId, fileId))
}

export async function updateFileStageStatus(input: {
  fileId: string
  stage: FileProcessStage
  status: FilePipelineStatus
  storageKey?: string | null
  errorCode?: string | null
  errorMessage?: string | null
  output?: Json
}): Promise<void> {
  const db = getDb()
  const now = new Date()
  await db
    .update(fileProcessTasks)
    .set({
      status: input.status,
      output: input.output,
      errorCode: input.errorCode,
      errorMsg: input.errorMessage,
      completedAt:
        input.status === 'ready' ||
        input.status === 'failed' ||
        input.status === 'skipped'
          ? now
          : null,
      updatedAt: now,
    })
    .where(
      and(
        eq(fileProcessTasks.fileId, input.fileId),
        eq(fileProcessTasks.stage, input.stage)
      )
    )

  const patch: Partial<typeof files.$inferInsert> = {
    processingUpdatedAt: now,
    updatedAt: now,
  }
  if (input.stage === 'preview') {
    patch.previewStatus = input.status
    patch.previewStorageKey = input.storageKey
    patch.previewError = input.errorMessage
  }
  if (input.stage === 'parse') {
    patch.parseStatus = input.status
    patch.parsedStorageKey = input.storageKey
    patch.parseError = input.errorMessage
  }
  if (input.stage === 'index') {
    patch.indexStatus = input.status
    patch.indexError = input.errorMessage
  }

  await db.update(files).set(patch).where(eq(files.id, input.fileId))
}

export async function markFileStages(input: {
  fileId: string
  stages: FileProcessStage[]
  status: FilePipelineStatus
}): Promise<void> {
  if (!input.stages.length) return
  const db = getDb()
  const now = new Date()
  await db
    .update(fileProcessTasks)
    .set({ status: input.status, updatedAt: now })
    .where(
      and(
        eq(fileProcessTasks.fileId, input.fileId),
        inArray(fileProcessTasks.stage, input.stages)
      )
    )
}

export async function claimNextPendingTask(workerId: string) {
  const db = getDb()
  const now = new Date()
  const rows = await db.transaction(async (tx) => {
    const picked = await tx
      .select({
        id: fileProcessTasks.id,
      })
      .from(fileProcessTasks)
      .where(
        and(
          eq(fileProcessTasks.status, 'pending'),
          lte(fileProcessTasks.runAfter, now),
          or(isNull(fileProcessTasks.lockedAt), lte(fileProcessTasks.lockedAt, now))
        )
      )
      .orderBy(desc(fileProcessTasks.priority), asc(fileProcessTasks.createdAt))
      .limit(1)
      .for('update', { skipLocked: true })

    const id = picked[0]?.id
    if (!id) return []

    await tx
      .update(fileProcessTasks)
      .set({
        status: 'processing',
        lockedBy: workerId,
        lockedAt: now,
        startedAt: now,
        updatedAt: now,
      })
      .where(eq(fileProcessTasks.id, id))

    return tx
      .select()
      .from(fileProcessTasks)
      .where(eq(fileProcessTasks.id, id))
      .limit(1)
  })

  return rows[0] ?? null
}

export async function claimNextQueuedTask(
  workerId: string,
  options: { maxMessages?: number; visibilityTimeoutSeconds?: number } = {}
) {
  const messages = await pgmqQueue.pull<FileProcessQueuePayload>(
    FILE_PROCESSING_QUEUE,
    options.maxMessages ?? 5,
    options.visibilityTimeoutSeconds ?? 60
  )
  const db = getDb()

  for (const message of messages) {
    if (!isFileProcessQueuePayload(message.payload)) {
      await pgmqQueue.ack(FILE_PROCESSING_QUEUE, message.id)
      continue
    }

    const now = new Date()
    const claimed = await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(fileProcessTasks)
        .where(eq(fileProcessTasks.id, message.payload.taskId))
        .limit(1)
        .for('update', { skipLocked: true })

      const task = rows[0]
      if (!task) return { shouldAck: true, task: null }
      if (
        task.fileId !== message.payload.fileId ||
        task.stage !== message.payload.stage
      ) {
        return { shouldAck: true, task: null }
      }
      if (task.status !== 'pending') {
        return { shouldAck: true, task: null }
      }
      if (task.runAfter > now) {
        return { shouldAck: false, task: null }
      }

      await tx
        .update(fileProcessTasks)
        .set({
          status: 'processing',
          attempts: task.attempts + 1,
          lockedBy: workerId,
          lockedAt: now,
          startedAt: now,
          updatedAt: now,
        })
        .where(eq(fileProcessTasks.id, task.id))

      const [updated] = await tx
        .select()
        .from(fileProcessTasks)
        .where(eq(fileProcessTasks.id, task.id))
        .limit(1)

      return { shouldAck: false, task: updated ?? null }
    })

    if (claimed.shouldAck) {
      await pgmqQueue.ack(FILE_PROCESSING_QUEUE, message.id)
    }
    if (claimed.task) {
      return { messageId: message.id, task: claimed.task }
    }
  }

  return null
}

export async function ackQueuedTask(messageId: string): Promise<void> {
  await pgmqQueue.ack(FILE_PROCESSING_QUEUE, messageId)
}
