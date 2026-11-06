import { useEffect, useMemo, useState } from 'react'
import { listMemberDirectory, type PublicMemberProfile } from '../../services/members'
import { useDebounce } from '../../hooks/useDebounce'
import Avatar from '../../components/ui/Avatar'
import EmptyState from '../../components/ui/EmptyState'
import Loading from '../../components/ui/Loading'
import { RoleBadge } from '../../components/ui/StatusBadge'
import { friendlyError } from '../../utils/errors'

/**
 * Family directory for members — read-only list of active members.
 * No administrative actions are available here.
 */
export default function MemberMembers() {
  const [members, setMembers] = useState<PublicMemberProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { members: data, error: queryError } = await listMemberDirectory(debouncedSearch)
      if (!cancelled) {
        setError(queryError ? friendlyError(queryError) : '')
        setMembers(data)
        setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [debouncedSearch, retryCount])

  const grouped = useMemo(() => {
    // Group by first letter of name for a clean, scannable directory.
    const groups = new Map<string, PublicMemberProfile[]>()
    for (const m of members) {
      const letter = (m.full_name?.charAt(0) ?? '#').toUpperCase()
      groups.set(letter, [...(groups.get(letter) ?? []), m])
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [members])

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-text">Wanachama</h1>
        <p className="text-text-secondary text-sm mt-0.5">Wanachama {members.length} wa 2021familyforever</p>
      </div>

      <div className="relative mb-4">
        <input
          type="search"
          className="input pl-9"
          placeholder="Tafuta wanachama…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Tafuta wanachama"
        />
        <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {error ? (
        <div className="card p-5 text-center" role="alert">
          <p className="text-sm text-error">{error}</p>
          <button
            type="button"
            className="btn btn-secondary mt-3"
            onClick={() => setRetryCount(value => value + 1)}
          >
            Jaribu tena
          </button>
        </div>
      ) : loading ? (
        <Loading />
      ) : members.length === 0 ? (
        <EmptyState
          title={search ? 'Hakuna matokeo yanayolingana' : 'Hakuna wanachama'}
          message={search ? 'Jaribu utafutaji mwingine.' : undefined}
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([letter, group]) => (
            <section key={letter} aria-label={`Wanachama wanaoanza na ${letter}`}>
              <h2 className="text-xs font-bold tracking-[0.15em] text-text-secondary uppercase mb-2">{letter}</h2>
              <div className="card divide-y divide-border-light overflow-hidden">
                {group.map(m => (
                  <div key={m.user_id}>
                    <div className="flex items-center gap-3 p-3.5">
                      <Avatar src={m.profile_picture} name={m.full_name} className="w-10 h-10 text-sm" />
                      <button
                        type="button"
                        onClick={() => setExpandedMemberId(current => current === m.user_id ? null : m.user_id)}
                        className="flex min-h-10 min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition-colors hover:bg-primary-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        aria-label={`Tazama wasifu wa ${m.full_name}`}
                        aria-expanded={expandedMemberId === m.user_id}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 truncate text-sm font-medium text-text">
                            {m.full_name}
                            {m.role === 'ADMIN' && (
                              <span className="badge shrink-0 border bg-secondary-50 text-secondary border-secondary/20">
                                <span aria-hidden className="mr-1">★</span>
                              </span>
                            )}
                          </p>
                          {(m.region || m.city) && (
                            <p className="truncate text-xs text-text-secondary">
                              {[m.city, m.region].filter(Boolean).join(', ')}
                            </p>
                          )}
                        </div>
                        <span className="text-text-secondary" aria-hidden="true">
                          {expandedMemberId === m.user_id ? '⌄' : '›'}
                        </span>
                      </button>
                    </div>
                    {expandedMemberId === m.user_id && (
                      <div className="border-t border-border-light bg-primary-50/30 px-4 pb-4 pt-3 sm:ml-[4.25rem] sm:mr-4 sm:mb-4 sm:rounded-xl sm:border">
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={m.profile_picture}
                            name={m.full_name}
                            className="h-14 w-14 shrink-0 rounded-2xl text-lg"
                          />
                          <div className="min-w-0">
                            <h3 className="break-words font-bold text-text">{m.full_name}</h3>
                            {m.role === 'ADMIN' && (
                              <div className="mt-1"><RoleBadge role="ADMIN" /></div>
                            )}
                          </div>
                        </div>
                        <dl className="mt-3 grid grid-cols-1 gap-3 rounded-xl border border-border-light bg-surface p-3 sm:grid-cols-2">
                          {m.city && (
                            <div>
                              <dt className="text-xs text-text-secondary">Mji</dt>
                              <dd className="mt-0.5 font-medium text-text">{m.city}</dd>
                            </div>
                          )}
                          {m.region && (
                            <div>
                              <dt className="text-xs text-text-secondary">Mkoa</dt>
                              <dd className="mt-0.5 font-medium text-text">{m.region}</dd>
                            </div>
                          )}
                          {!m.city && !m.region && (
                            <p className="text-sm text-text-secondary">Hakuna maelezo mengine ya umma yaliyowekwa.</p>
                          )}
                        </dl>
                        <p className="mt-3 text-xs text-text-secondary">
                          Maelezo ya faragha na mipangilio ya akaunti huonekana kwa msimamizi pekee.
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

    </div>
  )
}