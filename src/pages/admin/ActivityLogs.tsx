import { useCallback, useEffect, useMemo, useState } from 'react'
import { listApplicationActivity, listLastActiveUsers, type ApplicationActivity } from '../../services/reports'
import { supabase } from '../../types'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'
import { formatDate } from '../../utils/format'
import { friendlyError } from '../../utils/errors'
import EmptyState from '../../components/ui/EmptyState'
import Loading from '../../components/ui/Loading'

type ActivityType = ApplicationActivity['activity_type'] | 'ALL'
type ActivityProfile = { user_id: string; full_name: string; phone_number: string }

const typeLabels: Record<ApplicationActivity['activity_type'], string> = {
  LOGIN_SUCCESS: 'Kuingia kumefaulu',
  LOGIN_FAILED: 'Kuingia kumeshindikana',
  APP_VISIT: 'Ziara ya programu',
}

function activityStyle(type: ApplicationActivity['activity_type']) {
  if (type === 'LOGIN_SUCCESS') return 'bg-success-50 text-success border-success/20'
  if (type === 'LOGIN_FAILED') return 'bg-error-50 text-error border-error/20'
  return 'bg-primary-50 text-primary border-primary/20'
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString('sw-TZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function AdminActivityLogs() {
  const [activities, setActivities] = useState<ApplicationActivity[]>([])
  const [lastActive, setLastActive] = useState<{ actor_id: string; last_active_at: string }[]>([])
  const [profiles, setProfiles] = useState<Map<string, ActivityProfile>>(new Map())
  const [type, setType] = useState<ActivityType>('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [activityResult, activeResult] = await Promise.all([
      listApplicationActivity({
        activityType: type === 'ALL' ? undefined : type,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit: 500,
      }),
      listLastActiveUsers(),
    ])

    const queryError = activityResult.error ?? activeResult.error
    if (queryError) {
      setError(friendlyError(queryError))
      setActivities([])
      setLastActive([])
      setLoading(false)
      return
    }

    const activityRows = activityResult.activities
    const activeRows = activeResult.users
    const actorIds = [...new Set([
      ...activityRows.flatMap(row => row.actor_id ? [row.actor_id] : []),
      ...activeRows.map(row => row.actor_id),
    ])]

    if (actorIds.length === 0) {
      setActivities(activityRows)
      setLastActive(activeRows)
      setProfiles(new Map())
      setLoading(false)
      return
    }

    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, full_name, phone_number')
      .in('user_id', actorIds)

    if (profileError) {
      setError(friendlyError(profileError))
      setActivities([])
      setLastActive([])
      setLoading(false)
      return
    }

    setActivities(activityRows)
    setLastActive(activeRows)
    setProfiles(new Map(((profileRows ?? []) as ActivityProfile[]).map(profile => [profile.user_id, profile])))
    setLoading(false)
  }, [type, dateFrom, dateTo])

  useEffect(() => {
    void load()
  }, [load])

  useRealtimeRefresh(true, 'admin-activity-logs', [{ table: 'application_activity', event: 'INSERT' }], load)

  const filteredActivities = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    if (!term) return activities
    return activities.filter(activity => {
      const profile = activity.actor_id ? profiles.get(activity.actor_id) : undefined
      return [
        profile?.full_name,
        profile?.phone_number,
        activity.login_identifier,
        activity.ip_address,
        activity.user_agent,
        typeLabels[activity.activity_type],
      ].some(value => value?.toLocaleLowerCase().includes(term))
    })
  }, [activities, profiles, search])

  const successfulLogins = filteredActivities.filter(row => row.activity_type === 'LOGIN_SUCCESS').length
  const failedLogins = filteredActivities.filter(row => row.activity_type === 'LOGIN_FAILED').length
  const activeUsers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    const users = lastActive
      .map(row => ({ ...row, profile: profiles.get(row.actor_id) }))
      .filter(row => row.profile)
    return term
      ? users.filter(row =>
          row.profile?.full_name.toLocaleLowerCase().includes(term)
          || row.profile?.phone_number.toLocaleLowerCase().includes(term))
      : users
  }, [lastActive, profiles, search])

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">Kumbukumbu za shughuli</h1>
          <p className="mt-1 text-sm text-text-secondary">Kuingia kwa watumiaji na ziara za programu.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void load()} disabled={loading}>
          {loading ? 'Inapakia…' : 'Onyesha upya'}
        </button>
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-error/20 bg-error-50 p-4 text-sm text-error">
          <p>{error}</p>
          <button type="button" className="mt-2 font-semibold underline" onClick={() => void load()}>Jaribu tena</button>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Muhtasari wa kuingia">
        <div className="card p-4">
          <p className="text-sm text-text-secondary">Kuingia kumefaulu</p>
          <p className="mt-1 text-2xl font-bold text-success">{successfulLogins}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-text-secondary">Kuingia kumeshindikana</p>
          <p className="mt-1 text-2xl font-bold text-error">{failedLogins}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-text-secondary">Watumiaji walioonekana</p>
          <p className="mt-1 text-2xl font-bold text-primary">{activeUsers.length}</p>
        </div>
      </section>

      <section className="card space-y-4 p-4 sm:p-5">
        <div>
          <h2 className="font-semibold text-text">Shughuli za hivi karibuni</h2>
          <p className="text-sm text-text-secondary">Matukio 500 ya karibuni zaidi, yakisasishwa kiotomatiki.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            type="search"
            className="input"
            placeholder="Tafuta jina, simu au IP"
            aria-label="Tafuta kumbukumbu"
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
          <select className="input" value={type} onChange={event => setType(event.target.value as ActivityType)} aria-label="Chuja aina ya shughuli">
            <option value="ALL">Shughuli zote</option>
            <option value="LOGIN_SUCCESS">Kuingia kumefaulu</option>
            <option value="LOGIN_FAILED">Kuingia kumeshindikana</option>
            <option value="APP_VISIT">Ziara za programu</option>
          </select>
          <label className="text-xs text-text-secondary">
            Kuanzia
            <input type="date" className="input mt-1" value={dateFrom} onChange={event => setDateFrom(event.target.value)} />
          </label>
          <label className="text-xs text-text-secondary">
            Hadi
            <input type="date" className="input mt-1" value={dateTo} onChange={event => setDateTo(event.target.value)} />
          </label>
        </div>

        {loading ? <Loading label="Inapakia kumbukumbu…" /> : filteredActivities.length === 0 ? (
          <EmptyState title="Hakuna kumbukumbu" message="Hakuna shughuli zinazolingana na vichujio hivi." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-text-secondary">
                  <th className="px-3 py-3 font-semibold">Shughuli</th>
                  <th className="px-3 py-3 font-semibold">Mtumiaji</th>
                  <th className="px-3 py-3 font-semibold">IP</th>
                  <th className="px-3 py-3 font-semibold">Kifaa / kivinjari</th>
                  <th className="px-3 py-3 font-semibold">Tarehe na muda</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {filteredActivities.map(activity => {
                  const profile = activity.actor_id ? profiles.get(activity.actor_id) : undefined
                  return (
                    <tr key={activity.activity_id} className="align-top">
                      <td className="px-3 py-3">
                        <span className={`badge border ${activityStyle(activity.activity_type)}`}>{typeLabels[activity.activity_type]}</span>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-text">{profile?.full_name ?? activity.login_identifier ?? 'Mtumiaji asiyejulikana'}</p>
                        {profile?.phone_number && <p className="text-xs text-text-secondary">{profile.phone_number}</p>}
                      </td>
                      <td className="px-3 py-3 text-text-secondary">{activity.ip_address ?? '—'}</td>
                      <td className="max-w-[240px] px-3 py-3 text-xs text-text-secondary" title={activity.user_agent ?? undefined}>
                        <span className="line-clamp-2">{activity.user_agent ?? '—'}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-text-secondary" title={formatDate(activity.created_at)}>
                        {formatTimestamp(activity.created_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card space-y-4 p-4 sm:p-5">
        <div>
          <h2 className="font-semibold text-text">Watumiaji walioingia hivi karibuni</h2>
          <p className="text-sm text-text-secondary">Mara ya mwisho kila akaunti ilipoingia au kutembelea programu.</p>
        </div>
        {loading ? <Loading label="Inapakia watumiaji…" /> : activeUsers.length === 0 ? (
          <EmptyState title="Hakuna watumiaji walioingia" message="Hakuna ziara zilizorekodiwa kwa sasa." />
        ) : (
          <div className="divide-y divide-border-light">
            {activeUsers.slice(0, 10).map(row => (
              <div key={row.actor_id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-medium text-text">{row.profile?.full_name}</p>
                  <p className="text-sm text-text-secondary">{row.profile?.phone_number}</p>
                </div>
                <time className="text-sm text-text-secondary" dateTime={row.last_active_at}>
                  Mwisho: {formatTimestamp(row.last_active_at)}
                </time>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
