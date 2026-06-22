import type { SupabaseClient } from '@supabase/supabase-js'
import { handleDbError } from '@/lib/db/handle-db-error'
import {
  FILE_INTERACTION_USER_ROLE_AT_UPLOAD,
  type FileInteractionTypeValue,
} from '@/types/file-interactions'

/**
 * 上传成功后，按勾选写入 file_interactions（每种类型最多一条）。
 * 列：file_id, user_id, interaction_type, user_role_at_time
 */
export async function insertFileInteractionsForUpload(
  supabase: SupabaseClient,
  params: {
    fileId: string
    userId: string
    recommend: boolean
    favorite: boolean
  }
): Promise<void> {
  const rows: Array<{
    file_id: string
    user_id: string
    interaction_type: FileInteractionTypeValue
    user_role_at_time: typeof FILE_INTERACTION_USER_ROLE_AT_UPLOAD
  }> = []
  if (params.recommend) {
    rows.push({
      file_id: params.fileId,
      user_id: params.userId,
      interaction_type: 'recommend',
      user_role_at_time: FILE_INTERACTION_USER_ROLE_AT_UPLOAD,
    })
  }
  if (params.favorite) {
    rows.push({
      file_id: params.fileId,
      user_id: params.userId,
      interaction_type: 'favorite',
      user_role_at_time: FILE_INTERACTION_USER_ROLE_AT_UPLOAD,
    })
  }
  if (rows.length === 0) return

  const { error } = await supabase.from('file_interactions').insert(rows)
  if (error) handleDbError(error)
}
