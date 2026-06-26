import { sql } from 'drizzle-orm'
import { getDb } from '@/core/db/client'
import type { QueueMessage, QueuePort } from '@/core/ports/queue.port'

type PgmqSendRow = {
  msg_id?: number | string | bigint
  send?: number | string | bigint
}

type PgmqReadRow = {
  msg_id: number | string | bigint
  read_ct: number
  enqueued_at: Date | string
  message: unknown
}

function assertQueueName(queue: string): string {
  const name = queue.trim()
  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    throw new Error(`Invalid pgmq queue name: ${queue}`)
  }
  return name
}

function toMessageId(value: number | string | bigint): string {
  return String(value)
}

function readSendMessageId(row: PgmqSendRow | undefined): string {
  if (!row) throw new Error('pgmq send returned no rows')
  const value = row.msg_id ?? row.send ?? Object.values(row)[0]
  if (
    typeof value !== 'number' &&
    typeof value !== 'string' &&
    typeof value !== 'bigint'
  ) {
    throw new Error('pgmq send returned no message id')
  }
  return toMessageId(value)
}

export const pgmqQueue: QueuePort = {
  async enqueue<T>(queue: string, payload: T): Promise<string> {
    const db = getDb()
    const name = assertQueueName(queue)
    const rows = await db.execute<PgmqSendRow>(
      sql`select * from pgmq.send(${name}::text, ${JSON.stringify(payload)}::jsonb)`
    )
    return readSendMessageId(rows[0])
  },

  async pull<T>(
    queue: string,
    max: number,
    visibilityTimeoutSeconds = 60
  ): Promise<QueueMessage<T>[]> {
    const db = getDb()
    const name = assertQueueName(queue)
    const limit = Math.max(1, Math.trunc(max))
    const vt = Math.max(1, Math.trunc(visibilityTimeoutSeconds))
    const rows = await db.execute<PgmqReadRow>(
      sql`select * from pgmq.read(${name}::text, ${vt}::integer, ${limit}::integer)`
    )

    return rows.map((row) => ({
      id: toMessageId(row.msg_id),
      payload: row.message as T,
      attempts: row.read_ct,
      receivedAt:
        row.enqueued_at instanceof Date
          ? row.enqueued_at
          : new Date(row.enqueued_at),
    }))
  },

  async ack(queue: string, messageId: string): Promise<void> {
    const db = getDb()
    const name = assertQueueName(queue)
    await db.execute(sql`select pgmq.delete(${name}::text, ${BigInt(messageId)}::bigint)`)
  },
}

export async function ensurePgmqQueue(queue: string): Promise<void> {
  const db = getDb()
  const name = assertQueueName(queue)
  await db.execute(sql`
    select pgmq.create(${name}::text)
    where to_regclass(${`pgmq.q_${name}`}::text) is null
  `)
}
