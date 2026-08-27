import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase, type Announcement, type Notification, type Profile } from '../../types'
import { listMemberDirectory } from '../../services/members'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'
import { greetingForHour, formatDateShort, timeAgo, initialsOf } from '../../utils/format'
import EmptyState from '../../components/ui/EmptyState'
import Loading from '../../components/ui/Loading'

type StatusCounts = { paid: number; pending: number; unpaid: number }

export default function MemberHome() {
  const { user } = useAuth()
  const [counts, setCounts] = useState<StatusCounts | null>(null)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [activity, setActivity] = useState<Notification[]>([])
  const [directory, setDirectory] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [statusRes, annRes, notifRes, dirRes] = await Promise.all([
      supabase
        .from('v_member_contribution_status')
        .select('payment_status')
        .eq('member_id', user.user_id),
      supabase
        .from('announcements')
        .select('*')
        .eq('status', 'PUBLISHED')
        .order('published_at', { ascending: false })
        .limit(3),
      supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5),
      listMemberDirectory(),
    ])

    const rows = (statusRes.data ?? []) as { payment_status: string }[]
    setCounts({
      paid: rows.filter(r => r.payment_status === 'COMPLETED').length,
      pending: rows.filter(r => r.payment_status === 'PARTIAL' || r.payment_status === 'PENDING').length,
      unpaid: rows.filter(r => r.payment_status === 'UNPAID').length,
    })
    setAnnouncements((annRes.data ?? []) as Announcement[])
    setActivity((notifRes.data ?? []) as Notification[])
    setDirectory(dirRes.members.slice(0, 5))
    setLoading(false)
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  // Live updates: new announcements, payments and contribution changes
  // appear automatically without a manual refresh.
  useRealtimeRefresh(!!user, 'member-dashboard', [
    { table: 'announcements', event: 'INSERT' },
    { table: 'contributions', event: '*' },
    { table: 'payments', event: '*', filter: `member_id=eq.${user?.user_id ?? ''}` },
  ], load)

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-8">
      <div>
        <p className="text-xs font-bold tracking-[0.2em] text-secondary uppercase">Dashibodi</p>
        <h1 className="text-2xl font-bold text-text mt-1">
          {greetingForHour()}, {user?.full_name?.split(' ')[0]}
        </h1>
        <p className="text-text-secondary mt-1">Hii ni muhtasari wa akaunti yako ya 2021familyforever.</p>
      </div>

      {/* Contribution summary */}
      <section aria-label="Contribution summary">
        {loading ? (
          <Loading />
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <StatCard label="Imekamilika" value={counts?.paid ?? 0} color="success" mark="✓" />
            <StatCard label="Inaendelea" value={counts?.pending ?? 0} color="warning" mark="◔" />
            <StatCard label="Haijalipwa" value={counts?.unpaid ?? 0} color="error" mark="✕" />
          </div>
        )}
      </section>

      {/* Latest announcements */}
      <section aria-label="Latest announcements">
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title">Taarifa Mpya</h2>
          <Link to="/updates" className="text-sm font-medium text-primary hover:text-primary-600">
            Tazama zote
          </Link>
        </div>
        {loading ? (
          <Loading />
        ) : announcements.length === 0 ? (
          <EmptyState title="Hakuna taarifa bado" message="Taarifa muhimu za 2021familyforever zitaonekana hapa." />
        ) : (
          <div className="space-y-3">
            {announcements.map(a => {
              const d = formatDateShort(a.published_at)
              return (
                <Link key={a.announcement_id} to={`/updates?id=${a.announcement_id}`} className="card p-4 block hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 w-12 text-center border-r border-border pr-3">
                      <p className="text-lg font-bold text-text leading-none">{d.day}</p>
                      <p className="text-[10px] font-semibold text-secondary tracking-wide">{d.month}</p>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-text text-sm sm:text-base">{a.title}</h3>
                      <p className="text-text-secondary text-xs sm:text-sm mt-1 line-clamp-2">{a.message}</p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Family directory preview */}
      <section aria-label="Family members">
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title">Wanachama wa 2021familyforever</h2>
          <Link to="/members" className="text-sm font-medium text-primary hover:text-primary-600">
            Tazama wote
          </Link>
        </div>
        <div className="card divide-y divide-border-light overflow-hidden">
          {directory.map(m => (
            <div key={m.user_id} className="flex items-center gap-3 p-3 sm:p-3.5">
              <div className="w-9 h-9 rounded-full bg-primary-50 text-primary text-xs font-semibold flex items-center justify-center shrink-0 overflow-hidden">
                {m.profile_picture ? (
                  <img src={m.profile_picture} alt="" loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  initialsOf(m.full_name)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text truncate">{m.full_name}</p>
                {(m.city || m.region) && (
                  <p className="text-xs text-text-secondary truncate">{[m.city, m.region].filter(Boolean).join(', ')}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent activity */}
      <section aria-label="Recent activity">
        <h2 className="section-title mb-3">Shughuli za Karibuni</h2>
        {loading ? (
          <Loading />
        ) : activity.length === 0 ? (
          <EmptyState title="Hakuna shughuli za karibuni" message="Malipo na taarifa zitaonekana hapa." />
        ) : (
          <div className="card divide-y divide-border-light">
            {activity.map(n => (
              <div key={n.notification_id} className="flex items-center justify-between gap-3 p-3.5 sm:p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text truncate">{n.title}</p>
                  <p className="text-xs text-text-secondary line-clamp-1">{n.message}</p>
                </div>
                <span className="text-xs text-text-secondary whitespace-nowrap shrink-0">{timeAgo(n.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  )
}

function StatCard({ label, value, color, mark }: { label: string; value: number; color: 'success' | 'warning' | 'error'; mark: string }) {
  const colors = {
    success: 'bg-success-50 text-success',
    warning: 'bg-warning-50 text-warning',
    error: 'bg-error-50 text-error',
  }
  return (
    <div className="card p-4 sm:p-5 text-center">
      <div className={`inline-flex items-center gap-1.5 text-2xl sm:text-3xl font-bold ${colors[color]}`}>
        <span aria-hidden className="text-base">{mark}</span>
        {value}
      </div>
      <div className="text-xs sm:text-sm text-text-secondary mt-1">{label}</div>
    </div>
  )
}