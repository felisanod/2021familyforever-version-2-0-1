import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Notification, NotificationType } from '../../types'
import { useAuth } from '../../contexts/AuthContext'
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  subscribeToNotifications,
} from '../../services/notifications'
import { formatRelativeDay } from '../../utils/format'
import EmptyState from '../../components/ui/EmptyState'
import Loading from '../../components/ui/Loading'

const TYPE_ICONS: Record<NotificationType, string> = {
  ANNOUNCEMENT: '📣',
  CONTRIBUTION: '📋',
  PAYMENT: '💰',
  ACCOUNT: '👤',
  SYSTEM: '⚙️',
}

export default function MemberNotifications() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const { notifications: data } = await listNotifications()
      if (!cancelled) {
        setNotifications(data)
        setLoading(false)
      }
    }
    void load()

    // Realtime: new notifications appear immediately.
    const unsubscribe = subscribeToNotifications(
      user.user_id,
      n => setNotifications(list => [n, ...list]),
      updated =>
        setNotifications(list => list.map(n => (n.notification_id === updated.notification_id ? updated : n)))
    )

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [user])

  const unreadCount = notifications.filter(n => !n.is_read).length

  const grouped = useMemo(() => {
    const groups = new Map<string, Notification[]>()
    for (const n of notifications) {
      const key = formatRelativeDay(n.created_at)
      groups.set(key, [...(groups.get(key) ?? []), n])
    }
    return [...groups.entries()]
  }, [notifications])

  /** Deep link: open related content and mark read. */
  const handleOpen = async (n: Notification) => {
    if (!n.is_read) {
      setNotifications(list => list.map(x => (x.notification_id === n.notification_id ? { ...x, is_read: true } : x)))
      void markNotificationRead(n.notification_id)
    }
    if (!n.related_id) return
    switch (n.type) {
      case 'ANNOUNCEMENT':
        navigate(`/announcements?id=${n.related_id}`)
        break
      case 'PAYMENT':
      case 'CONTRIBUTION':
        navigate('/contributions')
        break
      case 'ACCOUNT':
        navigate('/profile')
        break
      default:
        break
    }
  }

  const handleMarkAll = async () => {
    setMarkingAll(true)
    await markAllNotificationsRead()
    setNotifications(list => list.map(n => ({ ...n, is_read: true })))
    setMarkingAll(false)
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <div className="flex items-center justify-between mb-5 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">Arifa</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-secondary font-medium mt-0.5">{unreadCount} hazijasomwa</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={handleMarkAll} disabled={markingAll} className="btn btn-ghost btn-sm shrink-0">
            {markingAll ? 'Inaweka alama…' : 'Weka alama zote zimesomwa'}
          </button>
        )}
      </div>

      {loading ? (
        <Loading />
      ) : notifications.length === 0 ? (
        <EmptyState title="Umesoma yote." message="Arifa mpya zitaonekana hapa." />
      ) : (
        <div className="space-y-6">
          {grouped.map(([dayLabel, items]) => (
            <section key={dayLabel} aria-label={dayLabel}>
              <h2 className="text-xs font-bold tracking-[0.15em] text-text-secondary uppercase mb-2">{dayLabel}</h2>
              <div className="card divide-y divide-border-light overflow-hidden">
                {items.map(n => (
                  <button
                    key={n.notification_id}
                    onClick={() => handleOpen(n)}
                    className={`w-full text-left flex items-start gap-3 p-4 transition-colors hover:bg-border-light ${
                      !n.is_read ? 'bg-primary-50/40' : ''
                    }`}
                  >
                    <span className="text-xl leading-none mt-0.5" aria-hidden>
                      {TYPE_ICONS[n.type]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={`text-sm ${!n.is_read ? 'font-semibold text-text' : 'font-medium text-text'}`}>
                          {n.title}
                        </span>
                        {!n.is_read && <span className="w-2 h-2 rounded-full bg-secondary shrink-0" aria-label="Haijasomwa" />}
                      </span>
                      <span className="block text-xs text-text-secondary mt-0.5 line-clamp-2">{n.message}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}