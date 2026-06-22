'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  getNotificationsSnapshot,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from '@/actions/notifications.action'
import type { NotificationListItem } from '@/lib/db/notifications'
import { enrichNotificationRow } from '@/lib/notifications/enrich-sender'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/types/database'

export function useNotifications(userId: string | null) {
  const [items, setItems] = useState<NotificationListItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!userId) {
      setItems([])
      setUnreadCount(0)
      return
    }
    setLoading(true)
    const result = await getNotificationsSnapshot()
    setLoading(false)
    if (result.success && result.data) {
      setItems(result.data.items)
      setUnreadCount(result.data.unreadCount)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      const result = await getNotificationsSnapshot()
      if (cancelled) return
      setLoading(false)
      if (result.success && result.data) {
        setItems(result.data.items)
        setUnreadCount(result.data.unreadCount)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            const row = payload.new as Tables<'notifications'>
            void enrichNotificationRow(row).then((enriched) => {
              setItems((prev) => {
                if (prev.some((n) => n.id === enriched.id)) return prev
                return [enriched, ...prev]
              })
            })
            if (!row.is_read) {
              setUnreadCount((c) => c + 1)
            }
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const row = payload.new as Tables<'notifications'>
            const old = payload.old as Tables<'notifications'> | undefined
            setItems((prev) =>
              prev.map((n) => {
                if (n.id !== row.id) return n
                if (row.sender_id === n.sender_id) {
                  return { ...row, sender: n.sender }
                }
                if (!row.sender_id) {
                  return { ...row, sender: null }
                }
                void enrichNotificationRow(row).then((enriched) => {
                  setItems((prev2) =>
                    prev2.map((x) => (x.id === row.id ? enriched : x)),
                  )
                })
                return { ...row, sender: null }
              }),
            )
            if (old && !old.is_read && row.is_read) {
              setUnreadCount((c) => Math.max(0, c - 1))
            } else if (old?.is_read && !row.is_read) {
              setUnreadCount((c) => c + 1)
            }
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId])

  const markRead = useCallback(async (notificationId: string) => {
    const result = await markNotificationReadAction(notificationId)
    if (result.success) {
      setItems((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n,
        ),
      )
    }
    return result
  }, [])

  const markAllRead = useCallback(async () => {
    const result = await markAllNotificationsReadAction()
    if (result.success) {
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnreadCount(0)
    }
    return result
  }, [])

  return {
    items,
    unreadCount,
    loading,
    refresh,
    markRead,
    markAllRead,
  }
}
