import { useState, useEffect, useCallback, useRef } from 'react'
import type { Notification } from '../types'
import { getUnreadAnnouncementCount, getUnreadCount, subscribeToNotifications } from '../services/notifications'

/**
 * Realtime unread notification badge.
 * Updates when notifications arrive, are opened, or marked read.
 */
export function useNotifications(userId: string | undefined) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [unreadAnnouncementCount, setUnreadAnnouncementCount] = useState(0)
  const [latest, setLatest] = useState<Notification | null>(null)

  const refresh = useCallback(async () => {
    if (!userId) return
    const [all, announcements] = await Promise.all([getUnreadCount(), getUnreadAnnouncementCount()])
    setUnreadCount(all)
    setUnreadAnnouncementCount(announcements)
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0)
      setUnreadAnnouncementCount(0)
      return
    }
    void refresh()
    const unsubscribe = subscribeToNotifications(
      userId,
      notification => {
        setLatest(notification)
        setUnreadCount(c => c + 1)
        if (notification.type === 'ANNOUNCEMENT') setUnreadAnnouncementCount(c => c + 1)
      },
      () => void refresh()
    )
    return unsubscribe
  }, [userId, refresh])

  // Re-sync when the tab regains focus (covers missed realtime events).
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh
  useEffect(() => {
    const onFocus = () => void refreshRef.current()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  return { unreadCount, unreadAnnouncementCount, latest, refresh: refreshRef.current }
}
