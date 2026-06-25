import { randomUUID } from 'node:crypto'
import { getDb } from '@/core/db/client'
import { fileDownloadRecord } from '@/core/db/schema'

export async function insertFileDownloadRecord(input: {
  fileId: string
  /** `public.users.id` */
  userId: string | null
  ipAddress: string | null
}): Promise<void> {
  const db = getDb()
  const now = new Date()
  await db.insert(fileDownloadRecord).values({
    id: randomUUID(),
    fileId: input.fileId,
    userId: input.userId,
    ipAddress: input.ipAddress,
    downloadedAt: now,
    createdAt: now,
  })
}
