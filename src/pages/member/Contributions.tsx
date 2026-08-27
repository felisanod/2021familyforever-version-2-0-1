import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase, type MemberContributionStatus } from '../../types'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'
import { formatTZS, formatDate } from '../../utils/format'
import { AggregateBadge } from '../../components/ui/StatusBadge'
import PaymentProgressBar from '../../components/ui/PaymentProgressBar'
import EmptyState from '../../components/ui/EmptyState'
import Loading from '../../components/ui/Loading'

type Tab = 'ALL' | 'COMPLETED' | 'PARTIAL' | 'PENDING' | 'UNPAID'

export default function MemberContributions() {
  const { user } = useAuth()
  const [rows, setRows] = useState<MemberContributionStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('ALL')

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase
      .from('v_member_contribution_status')
      .select('*')
      .eq('member_id', user.user_id)
      .order('due_date', { ascending: false })

    if (err) setError('Kuna kitu hakifanyi kazi. Tafadhali jaribu tena.')
    else setRows((data ?? []) as unknown as MemberContributionStatus[])
    setLoading(false)
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  // Live updates: payment and contribution changes appear automatically.
  useRealtimeRefresh(!!user, 'member-contributions', [
    { table: 'payments', event: '*', filter: `member_id=eq.${user?.user_id ?? ''}` },
    { table: 'contributions', event: '*' },
  ], load)

  const filtered = useMemo(() => (tab === 'ALL' ? rows : rows.filter(r => r.payment_status === tab)), [rows, tab])

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-text">Michango</h1>
        <p className="text-text-secondary mt-1 text-sm">Rekodi zako za michango na maendeleo ya malipo.</p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Chuja kwa hali ya malipo">
        {(['ALL', 'COMPLETED', 'PARTIAL', 'PENDING', 'UNPAID'] as Tab[]).map(t => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`badge border px-3.5 py-1.5 cursor-pointer transition-colors whitespace-nowrap ${
              tab === t ? 'bg-primary text-white border-primary' : 'bg-surface text-text-secondary border-border hover:bg-border-light'
            }`}
          >
            {t === 'ALL'
              ? `Zote (${rows.length})`
              : t === 'COMPLETED'
                ? `Imekamilika (${rows.filter(r => r.payment_status === t).length})`
                : t === 'PARTIAL'
                  ? `Kiasi (${rows.filter(r => r.payment_status === t).length})`
                  : t === 'PENDING'
                    ? `Inasubiri (${rows.filter(r => r.payment_status === t).length})`
                    : `Haijalipwa (${rows.filter(r => r.payment_status === t).length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <EmptyState title={error} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={rows.length === 0 ? 'Hakuna michango bado' : 'Hakuna michango inayolingana'}
          message={rows.length === 0 ? 'Rekodi zako za michango zitaonekana hapa.' : 'Jaribu kichujio kingine.'}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(row => (
            <article key={`${row.contribution_id}-${row.member_id}`} className="card p-4 sm:p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-text">{row.title}</h3>
                  {row.description && <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">{row.description}</p>}
                </div>
                <AggregateBadge status={row.payment_status} />
              </div>

              {/* Money summary */}
              <dl className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-border-light/40 py-1.5">
                  <dt className="text-text-secondary text-[10px] uppercase font-semibold">Kinachohitajika</dt>
                  <dd className="font-semibold text-text">{formatTZS(row.required_amount)}</dd>
                </div>
                <div className="rounded-lg bg-border-light/40 py-1.5">
                  <dt className="text-text-secondary text-[10px] uppercase font-semibold">Kilicholipwa</dt>
                  <dd className="font-semibold text-success">{formatTZS(row.total_paid)}</dd>
                </div>
                <div className="rounded-lg bg-border-light/40 py-1.5">
                  <dt className="text-text-secondary text-[10px] uppercase font-semibold">{Number(row.overpaid_amount) > 0 ? 'Lilizidi' : 'Kilichobaki'}</dt>
                  <dd className={`font-semibold ${Number(row.overpaid_amount) > 0 ? 'text-primary' : 'text-error'}`}>
                    {formatTZS(Number(row.overpaid_amount) > 0 ? row.overpaid_amount : row.remaining_amount)}
                  </dd>
                </div>
              </dl>

              {/* Dynamic progress */}
              <PaymentProgressBar percent={Number(row.progress_percent)} />

              <p className="text-xs text-text-secondary">
                Inaisha {formatDate(row.due_date)}
                {row.last_payment_date && ` · Malipo ya mwisho ${formatDate(row.last_payment_date)}`}
                {` · Malipo ${row.payment_count}`}
              </p>

              {row.contribution_status === 'CLOSED' && row.payment_status !== 'COMPLETED' && (
                <p className="text-xs text-error bg-error-50 rounded-lg px-3 py-2 inline-block">
                  Mchango huu umefungwa kabla malipo yako hayajakamilika.
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}