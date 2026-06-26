/**
 * Queue port. The default implementation is pgmq inside PostgreSQL.
 * Business modules should depend on this interface instead of pgmq SQL.
 */
export interface QueueMessage<T = unknown> {
  /** Queue message id, used by ack/delete. */
  id: string
  payload: T
  attempts: number
  receivedAt: Date
}

export interface QueuePort {
  enqueue<T>(queue: string, payload: T): Promise<string>
  pull<T>(
    queue: string,
    max: number,
    visibilityTimeoutSeconds?: number
  ): Promise<QueueMessage<T>[]>
  ack(queue: string, messageId: string): Promise<void>
}
