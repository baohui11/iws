import { pgmqQueue } from '@/core/queue/pgmq'
import { runLoggedOaSync } from '../services/sync-runner'
import type { OaSyncScope, OaSyncTrigger } from '../types'

export const OA_SYNC_QUEUE = 'oa_sync'

export interface OaSyncQueuePayload {
  scope: OaSyncScope
  trigger?: OaSyncTrigger
}

function isScope(value: unknown): value is OaSyncScope {
  return (
    value === 'departments' ||
    value === 'users' ||
    value === 'projects' ||
    value === 'project_roles'
  )
}

function isTrigger(value: unknown): value is OaSyncTrigger {
  return value === 'manual' || value === 'cron' || value === 'worker'
}

export async function enqueueOaSync(payload: OaSyncQueuePayload): Promise<string> {
  return pgmqQueue.enqueue(OA_SYNC_QUEUE, payload)
}

export async function processOaSyncQueueBatch(input: {
  max?: number
  visibilityTimeoutSeconds?: number
} = {}): Promise<number> {
  const messages = await pgmqQueue.pull<Partial<OaSyncQueuePayload>>(
    OA_SYNC_QUEUE,
    input.max ?? 5,
    input.visibilityTimeoutSeconds ?? 900
  )

  let processed = 0
  for (const message of messages) {
    const { scope, trigger } = message.payload
    if (!isScope(scope)) {
      await pgmqQueue.ack(OA_SYNC_QUEUE, message.id)
      continue
    }

    await runLoggedOaSync(scope, isTrigger(trigger) ? trigger : 'worker')
    await pgmqQueue.ack(OA_SYNC_QUEUE, message.id)
    processed += 1
  }

  return processed
}
