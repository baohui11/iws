import { createClient } from '@/lib/supabase/server'
import { handleDbError } from '@/lib/db/handle-db-error'
import type { Tables } from '@/types/database'

export type NotificationRow = Tables<'notifications'>

/** 列表查询附带发送者头像（sender_id → users.avatar_url） */
export type NotificationListItem = NotificationRow & {
  sender: { avatar_url: string | null } | null
}

const NOTIFICATION_SELECT = `
  *,
  sender:users!notifications_sender_id_fkey (
    avatar_url
  )
`

const DEFAULT_LIMIT = 50

type RawNotificationRow = NotificationRow & {
  sender?: { avatar_url: string | null } | null
}

function normalizeListItem(row: RawNotificationRow): NotificationListItem {
  const { sender, ...rest } = row
  if (!rest.sender_id) {
    return { ...rest, sender: null }
  }
  return {
    ...rest,
    sender: { avatar_url: sender?.avatar_url ?? null },
  }
}

export async function listNotificationsForUser(
  userId: string,
  limit = DEFAULT_LIMIT,
): Promise<NotificationListItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notifications')
    .select(NOTIFICATION_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) handleDbError(error)
  return (data ?? []).map((row) => normalizeListItem(row as RawNotificationRow))
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)

  if (error) handleDbError(error)
  return count ?? 0
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId)

  if (error) handleDbError(error)
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)

  if (error) handleDbError(error)
}
