/**
 * 队列端口。实现：默认 pgmq（PG 内）；重型解析管线可选 Celery/Redis。
 * 业务层只依赖此接口。
 */

export interface QueueMessage<T = unknown> {
  /** 队列消息 id（用于 ack） */
  id: string
  payload: T
  attempts: number
  receivedAt: Date
}

export interface QueuePort {
  enqueue<T>(queue: string, payload: T): Promise<void>
  /** 拉取至多 max 条消息（实现需保证可见性超时 / SKIP LOCKED） */
  pull<T>(queue: string, max: number): Promise<QueueMessage<T>[]>
  ack(queue: string, messageId: string): Promise<void>
}
