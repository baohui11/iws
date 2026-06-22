'use server'

import { handleAction } from '@/lib/action-handler'
import { AuthError, ValidationError } from '@/lib/errors'
import { getProfileById } from '@/lib/db/auth/profile'
import {
  countUnreadNotifications,
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationListItem,
} from '@/lib/db/notifications'
import { createClient } from '@/lib/supabase/server'

async function requireUserId(): Promise<string> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new AuthError('请先登录')

  const profile = await getProfileById(user.id)
  if (!profile) throw new AuthError('请先登录')
  return profile.id
}

export async function getNotificationsSnapshot() {
  return handleAction(async () => {
    const userId = await requireUserId()
    const [items, unreadCount] = await Promise.all([
      listNotificationsForUser(userId),
      countUnreadNotifications(userId),
    ])
    return { items, unreadCount } satisfies {
      items: NotificationListItem[]
      unreadCount: number
    }
  })
}

export async function markNotificationReadAction(notificationId: string) {
  return handleAction(async () => {
    const userId = await requireUserId()
    if (!notificationId?.trim()) {
      throw new ValidationError('通知 ID 无效')
    }
    await markNotificationRead(userId, notificationId.trim())
  })
}

export async function markAllNotificationsReadAction() {
  return handleAction(async () => {
    const userId = await requireUserId()
    await markAllNotificationsRead(userId)
  })
}
