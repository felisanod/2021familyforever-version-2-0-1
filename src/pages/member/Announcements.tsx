import { useCallback, useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import type { Announcement } from '../../types'
import { listVisibleAnnouncements, getAuthorName } from '../../services/announcements'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'
import { formatDateShort, formatDate } from '../../utils/format'
import EmptyState from '../../components/ui/EmptyState'
import Loading from '../../components/ui/Loading'

export default function MemberAnnouncements() {
  const [searchParams] = useSearchParams()
  const selectedId = searchParams.get('id')

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { announcements: data, error: err } = await listVisibleAnnouncements()
    if (err) setError('Kuna kitu hakifanyi kazi. Tafadhali jaribu tena.')
    else setAnnouncements(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Live updates: newly published announcements appear automatically.
  useRealtimeRefresh(true, 'member-updates', [
    { table: 'announcements', event: '*' },
  ], load)

  const selected = selectedId ? announcements.find(a => a.announcement_id === selectedId) : null

  // Detail reading layout
  if (selected) return <AnnouncementDetail announcement={selected} />

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <p className="text-xs font-bold tracking-[0.2em] text-secondary uppercase">Taarifa</p>
        <h1 className="text-2xl font-bold text-text mt-1">Taarifa za 2021familyforever</h1>
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <EmptyState title={error} />
      ) : announcements.length === 0 ? (
        <EmptyState title="Hakuna taarifa bado" message="Taarifa muhimu za 2021familyforever zitaonekana hapa." />
      ) : (
        <ol className="relative border-l-2 border-border ml-6 space-y-8 pb-4">
          {announcements.map(a => {
            const d = formatDateShort(a.published_at ?? a.created_at)
            return (
              <li key={a.announcement_id} className="relative pl-6">
                {/* Timeline node */}
                <span className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-primary border-[3px] border-background" aria-hidden />

                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-sm font-bold text-text">{d.day}</span>
                  <span className="text-xs font-semibold text-secondary tracking-wide">{d.month}</span>
                </div>

                <Link to={`/updates?id=${a.announcement_id}`} className="group block">
                  <h2 className="font-semibold text-text group-hover:text-primary transition-colors">{a.title}</h2>
                  <p className="text-sm text-text-secondary mt-1 line-clamp-2 leading-relaxed">{a.message}</p>
                  <span className="inline-block mt-2 text-xs font-semibold text-primary group-hover:text-primary-600">
                    SOMA ZAIDI →
                  </span>
                </Link>

                {a.image_url && (
                  <img src={a.image_url} alt="" loading="lazy" className="mt-3 rounded-xl max-h-56 w-full object-cover" />
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

function AnnouncementDetail({ announcement }: { announcement: Announcement }) {
  const [author, setAuthor] = useState('')

  useEffect(() => {
    void getAuthorName(announcement.created_by).then(setAuthor)
  }, [announcement.created_by])

  const expired = announcement.expires_at && new Date(announcement.expires_at) < new Date()

  return (
    <article className="max-w-2xl mx-auto p-4 sm:p-6">
      <Link to="/updates" className="text-sm font-medium text-primary hover:text-primary-600">
        ← Rudi kwenye Taarifa
      </Link>

      <header className="mt-5">
        <p className="text-xs font-bold tracking-[0.2em] text-secondary uppercase">
          Imechapishwa {formatDate(announcement.published_at ?? announcement.created_at)}
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-text mt-2 leading-tight">{announcement.title}</h1>
        <p className="text-sm text-text-secondary mt-2">
          Na {author}
          {announcement.expires_at && !expired && <> · Inaisha {formatDate(announcement.expires_at)}</>}
          {expired && <> · Muda uliisha {formatDate(announcement.expires_at)}</>}
        </p>
      </header>

      {announcement.image_url && (
        <img src={announcement.image_url} alt="" className="mt-5 rounded-2xl w-full object-cover max-h-96" />
      )}

      <div className="mt-6 text-[15px] sm:text-base text-text leading-relaxed whitespace-pre-wrap">
        {announcement.message}
      </div>

      {announcement.attachment_url && (
        <a
          href={announcement.attachment_url}
          target="_blank"
          rel="noreferrer"
          className="card inline-flex items-center gap-2 px-4 py-3 mt-6 text-sm font-medium text-primary hover:bg-primary-50"
        >
          📎 Angalia Kiambatisho
        </a>
      )}
    </article>
  )
}