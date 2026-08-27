import { supabase, type Notification } from '../types'

export async function listNotifications(limit = 100) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  return { notifications: (data ?? []) as Notification[], error }
}

export async function getUnreadCount(): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('is_read', false)
  return count ?? 0
}

/** Number of unread announcement notifications, used by the Taarifa badge. */
export async function getUnreadAnnouncementCount(): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('is_read', false)
    .eq('type', 'ANNOUNCEMENT')
  return count ?? 0
}

/** Marks announcement notifications as read after the member opens Taarifa. */
export async function markUnreadAnnouncementsRead() {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('is_read', false)
    .eq('type', 'ANNOUNCEMENT')
  return { error }
}

export async function markNotificationRead(notificationId: string) {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('notification_id', notificationId)
  return { error }
}

/** Backend RPC — marks every unread notification for the signed-in user. */
export async function markAllNotificationsRead() {
  const { data, error } = await supabase.rpc('mark_all_notifications_read')
  return { count: (data as number | null) ?? 0, error }
}

/** Subscribe to realtime inserts for the current user's notifications. */
export function subscribeToNotifications(
  userId: string,
  onInsert: (notification: Notification) => void,
  onUpdate: (notification: Notification) => void
) {
  const channel = supabase
    .channel(`notifications-${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `member_id=eq.${userId}` },
      payload => onInsert(payload.new as Notification)
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `member_id=eq.${userId}` },
      payload => onUpdate(payload.new as Notification)
    )
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}
