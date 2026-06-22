import { randomUUID } from 'node:crypto'

import { createAdminClient } from '@/lib/supabase/admin'
import { handleDbError } from '@/lib/db/handle-db-error'

export async function insertFileDownloadRecord(input: {
  fileId: string
  /** `public.users.id` */
  userId: string | null
  ipAddress: string | null
}): Promise<void> {
  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const { error } = await supabase.from('file_download_record').insert({
    id: randomUUID(),
    file_id: input.fileId,
    user_id: input.userId,
    ip_address: input.ipAddress,
    downloaded_at: now,
    created_at: now,
  })
  if (error) handleDbError(error)
}
