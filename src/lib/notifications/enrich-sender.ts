'use client'

import { createClient } from '@/lib/supabase/client'
import type { NotificationListItem } from '@/lib/db/notifications'
import type { Tables } from '@/types/database'

/** Realtime 等场景：仅含 notifications 行数据时补全 sender.avatar_url */
export async function enrichNotificationRow(
  row: Tables<'notifications'>,
): Promise<NotificationListItem> {
  if (!row.sender_id) {
    return { ...row, sender: null }
  }
  const supabase = createClient()
  const { data } = await supabase
    .from('users')
    .select('avatar_url')
    .eq('id', row.sender_id)
    .maybeSingle()
  return {
    ...row,
    sender: data ? { avatar_url: data.avatar_url } : { avatar_url: null },
  }
}
