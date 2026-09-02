import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../types'
import { useAuth } from '../../contexts/AuthContext'
import { listContributions, type ContributionWithStats } from '../../services/contributions'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'
import { greetingForHour, formatTZSCompact, formatDateFullSw } from '../../utils/format'
import Loading from '../../components/ui/Loading'

type Stats = {
  totalMembers: number
  activeMembers: number
  suspendedMembers: number
  openContributions: number
  closedContributions: number
  paidPayments: number
  totalCollected: number
  announcements: number
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [contributions, setContributions] = useState<ContributionWithStats[]>([])
  const [recentPayments, setRecentPayments] = useState<{ payment_id: string; amount: number; created_at: string; member_name: string | null; contribution_title: string | null }[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const head = { count: 'exact', head: true } as const

    const [
      totalRes, activeRes, suspendedRes,
      contributionsData, paidRes, sumRes, annRes, recentRes,
    ] = await Promise.all([
      supabase.from('profiles').select('*', head),
      supabase.from('profiles').select('*', head).eq('account_status', 'ACTIVE'),
      supabase.from('profiles').select('*', head).eq('account_status', 'SUSPENDED'),
      listContributions(),
      supabase.from('payments').select('*', head).eq('payment_status', 'PAID'),
      supabase.from('payments').select('amount'),
      supabase.from('announcements').select('*', head).eq('status', 'PUBLISHED'),
      supabase
        .from('payments')
        .select('payment_id, amount, created_at, member:profiles!payments_member_id_fkey(full_name), contribution:contributions(title)')
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    setStats({
      totalMembers: totalRes.count ?? 0,
      activeMembers: activeRes.count ?? 0,
      suspendedMembers: suspendedRes.count ?? 0,
      openContributions: contributionsData.contributions.filter(c => c.status === 'OPEN').length,
      closedContributions: contributionsData.contributions.filter(c => c.status === 'CLOSED').length,
      paidPayments: paidRes.count ?? 0,
      totalCollected: (sumRes.data ?? []).reduce((acc, p) => acc + Number(p.amount), 0),
      announcements: annRes.count ?? 0,
    })
    setContributions(contributionsData.contributions)
    setRecentPayments(
      ((recentRes.data ?? []) as unknown as {
        payment_id: string; amount: number; created_at: string
        member: { full_name: string }[] | null
        contribution: { title: string }[] | null
      }[]).map(p => ({
        payment_id: p.payment_id,
        amount: p.amount,
        created_at: p.created_at,
        member_name: p.member?.[0]?.full_name ?? null,
        contribution_title: p.contribution?.[0]?.title ?? null,
      }))
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Live updates: members, payments, contributions and announcements
  // refresh automatically without a manual reload.
  useRealtimeRefresh(true, 'admin-dashboard', [
    { table: 'profiles', event: '*' },
    { table: 'payments', event: '*' },
    { table: 'contributions', event: '*' },
    { table: 'announcements', event: '*' },
  ], load)

  const topOpen = [...contributions].filter(c => c.status === 'OPEN').slice(0, 4)
  const today = formatDateFullSw()

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">{greetingForHour()}, {user?.full_name?.split(' ')[0] ?? 'Admin'}</h1>
        <p className="text-text-secondary mt-1">{today}</p>
      </div>

      {loading ? (
        <Loading full />
      ) : (
        <>
          {/* Summary statistics */}
          <section aria-label="Takwimu za muhtasari" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard label="WANACHAMA" value={String(stats!.totalMembers)} sub={`${stats!.activeMembers} hai · ${stats!.suspendedMembers} wamesimamishwa`} accent />
            <StatCard label="MICHANGO" value={`${stats!.openContributions} Wazi`} sub={`${stats!.closedContributions} Imefungwa`} />
            <StatCard label="MALIPO" value={formatTZSCompact(stats!.totalCollected)} sub={`${stats!.paidPayments} yamerekodiwa`} />
            <StatCard label="TAARIFA" value={String(stats!.announcements)} sub="Zilizochapishwa" />
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Contribution progress */}
            <section className="card p-4 sm:p-6" aria-label="Maendeleo ya michango">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-text">Maendeleo ya Michango</h3>
                <Link to="/admin/contributions" className="text-xs font-medium text-primary hover:text-primary-600">Tazama zote</Link>
              </div>
              {topOpen.length === 0 ? (
                <p className="text-sm text-text-secondary py-6 text-center">Hakuna michango wazi kwa sasa.</p>
              ) : (
                <div className="space-y-4">
                  {topOpen.map(c => (
                    <div key={c.contribution_id}>
                      <div className="flex justify-between text-sm mb-1 gap-2">
                        <span className="text-text truncate">{c.title}</span>
                        <span className="font-semibold text-primary shrink-0">{c.completion_percent}%</span>
                      </div>
                      <div className="h-2 bg-border-light rounded-full overflow-hidden" role="progressbar" aria-valuenow={c.completion_percent} aria-valuemin={0} aria-valuemax={100}>
                        <div className="h-full bg-success rounded-full transition-all" style={{ width: `${c.completion_percent}%` }} />
                      </div>
                      <p className="text-xs text-text-secondary mt-1">
                        {c.completed_members} / {c.total_members} WALOMALIZA · {formatTZSCompact(c.total_collected)} kati ya {formatTZSCompact(c.amount * c.total_members)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Recent activity */}
            <section className="card p-4 sm:p-6" aria-label="Shughuli za karibuni">
              <h3 className="font-semibold text-text mb-4">Malipo ya Karibuni</h3>
              {recentPayments.length === 0 ? (
                <p className="text-sm text-text-secondary py-6 text-center">Hakuna malipo yaliyorekodiwa bado.</p>
              ) : (
                <div className="space-y-3">
                  {recentPayments.map(p => (
                    <div key={p.payment_id} className="flex items-start justify-between gap-3 pb-3 border-b border-border-light last:border-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text truncate">{p.member_name ?? 'Mwanachama'}</p>
                        <p className="text-xs text-text-secondary truncate">{p.contribution_title ?? 'Mchango'}</p>
                      </div>
                      <span className="text-sm font-semibold text-success whitespace-nowrap">+{formatTZSCompact(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`card p-4 sm:p-5 ${accent ? 'border-l-4 border-l-primary' : ''}`}>
      <p className="text-[10px] sm:text-xs font-bold tracking-wider text-text-secondary">{label}</p>
      <p className="text-xl sm:text-2xl font-bold text-text mt-1.5">{value}</p>
      {sub && <p className="text-xs text-text-secondary mt-1">{sub}</p>}
    </div>
  )
}