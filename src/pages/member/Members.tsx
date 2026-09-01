import { useEffect, useMemo, useState } from 'react'
import type { Profile } from '../../types'
import { listMemberDirectory } from '../../services/members'
import { useDebounce } from '../../hooks/useDebounce'
import Avatar from '../../components/ui/Avatar'
import EmptyState from '../../components/ui/EmptyState'
import Loading from '../../components/ui/Loading'

/**
 * Family directory for members — read-only list of active members.
 * No administrative actions are available here.
 */
export default function MemberMembers() {
  const [members, setMembers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { members: data } = await listMemberDirectory(debouncedSearch)
      if (!cancelled) {
        setMembers(data)
        setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [debouncedSearch])

  const grouped = useMemo(() => {
    // Group by first letter of name for a clean, scannable directory.
    const groups = new Map<string, Profile[]>()
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

      {loading ? (
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
                  <div key={m.user_id} className="flex items-center gap-3 p-3.5">
                    <Avatar src={m.profile_picture} name={m.full_name} className="w-10 h-10 text-sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text truncate flex items-center gap-2">
                        {m.full_name}
                        {m.role === 'ADMIN' && (
                          <span className="badge border bg-secondary-50 text-secondary border-secondary/20 shrink-0">
                            <span aria-hidden className="mr-1">★</span>
                          </span>
                        )}
                      </p>
                      {(m.region || m.city) && (
                        <p className="text-xs text-text-secondary truncate">
                          {[m.city, m.region].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
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