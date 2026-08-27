import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  listContributions,
  getContributionMemberStatuses,
  type ContributionWithStats,
  type ContributionMemberRow,
} from '../../services/contributions'
import { recordPayment, listPayments } from '../../services/payments'
import { useDebounce } from '../../hooks/useDebounce'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'
import { formatTZS, formatDate } from '../../utils/format'
import { friendlyError } from '../../utils/errors'
import { AggregateBadge } from '../../components/ui/StatusBadge'
import PaymentProgressBar from '../../components/ui/PaymentProgressBar'
import EmptyState from '../../components/ui/EmptyState'
import Loading from '../../components/ui/Loading'
import Modal from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'

const PAYMENT_METHODS = ['Fedha Taslimu', 'Pesa ya Simu', 'Uhamisho wa Benki', 'Nyingine']

/**
 * Payments management — select a contribution, search members,
 * assign/record payments (including additional payments toward partial
 * payments) and monitor dynamic payment progress.
 */
export default function AdminPayments() {
  const toast = useToast()
  const [contributions, setContributions] = useState<ContributionWithStats[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loadingContributions, setLoadingContributions] = useState(true)

  const [rows, setRows] = useState<ContributionMemberRow[]>([])
  const [loadingRows, setLoadingRows] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'UNPAID' | 'PARTIAL' | 'COMPLETED'>('ALL')
  const [selectedMember, setSelectedMember] = useState<ContributionMemberRow | null>(null)
  const [addPayOpen, setAddPayOpen] = useState(false)

  useEffect(() => {
    void listContributions().then(({ contributions }) => {
      setContributions(contributions)
      if (contributions.length > 0) setSelectedId(prev => prev || contributions[0].contribution_id)
      setLoadingContributions(false)
    })
  }, [])

  const loadRows = useCallback(async () => {
    if (!selectedId) return
    setLoadingRows(true)
    const { rows: data } = await getContributionMemberStatuses(selectedId)
    setRows(data)
    setLoadingRows(false)
    // Keep the selected member object fresh after payments change.
    setSelectedMember(prev => (prev ? data.find(r => r.member_id === prev.member_id) ?? null : null))
  }, [selectedId])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  // Live updates: payments recorded anywhere refresh member progress instantly.
  useRealtimeRefresh(!!selectedId, 'admin-payments', [
    { table: 'payments', event: '*' },
    { table: 'contributions', event: '*', filter: `contribution_id=eq.${selectedId}` },
  ], loadRows)

  const selectedContribution = contributions.find(c => c.contribution_id === selectedId) ?? null

  const filtered = useMemo(() => {
    let list = rows
    if (statusFilter !== 'ALL') list = list.filter(r => r.payment_status === statusFilter)
    if (debouncedSearch.trim()) {
      const term = debouncedSearch.trim().toLowerCase()
      list = list.filter(
        r =>
          r.profile?.full_name?.toLowerCase().includes(term) ||
          r.profile?.phone_number?.includes(term) ||
          r.profile?.region?.toLowerCase().includes(term) ||
          r.profile?.city?.toLowerCase().includes(term)
      )
    }
    return list
  }, [rows, statusFilter, debouncedSearch])

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-text">Malipo</h1>
        <p className="text-text-secondary text-sm mt-0.5">Chagua mchango, tafuta wanachama na rekodi malipo.</p>
      </div>

      {/* Step 1 — Select contribution */}
      <section aria-label="Select contribution" className="card p-4">
        <label className="label" htmlFor="pay-contribution">1 · Mchango</label>
        <select
          id="pay-contribution"
          className="input"
          value={selectedId}
          onChange={e => {
            setSelectedId(e.target.value)
            setSelectedMember(null)
            setSearch('')
            setStatusFilter('ALL')
          }}
        >
          {contributions.map(c => (
            <option key={c.contribution_id} value={c.contribution_id}>
              {c.title} — {formatTZS(c.amount)} ({c.status === 'OPEN' ? 'Wazi' : 'Imefungwa'}){c.status === 'CLOSED' ? ' — umefungwa' : ''}
            </option>
          ))}
        </select>
        {selectedContribution && (
          <p className="text-xs text-text-secondary mt-2">
            Kinachohitajika {formatTZS(selectedContribution.amount)} kwa kila mwanachama ·{' '}
            {selectedContribution.completed_members} wamekamilisha · {selectedContribution.partial_members} wamekamilisha kiasi ·{' '}
            {selectedContribution.unpaid_members + selectedContribution.pending_members} hawajalipa
            {selectedContribution.status === 'CLOSED' && (
              <span className="text-error font-medium"> · Mchango huu umefungwa — malipo mapya hayakubaliki.</span>
            )}
          </p>
        )}
      </section>

      {/* Step 2 — Search members */}
      <section aria-label="Members" className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <h2 className="font-semibold text-text shrink-0">2 · Wanachama</h2>
          <div className="relative flex-1">
            <input
              type="search"
              className="input pl-9"
              placeholder="Tafuta kwa jina, simu, mkoa au mji…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Tafuta wanachama"
            />
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <select className="input sm:w-48" value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} aria-label="Chuja kwa hali ya malipo">
            <option value="ALL">Hali zote</option>
            <option value="COMPLETED">Imekamilika</option>
            <option value="PARTIAL">Imekamilika Kiasi</option>
            <option value="PENDING">Inasubiri</option>
            <option value="UNPAID">Haijalipwa</option>
          </select>
        </div>

        {!selectedId ? (
          <EmptyState title="Hakuna michango bado" message="Tengeneza mchango kwanza." />
        ) : loadingRows || loadingContributions ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={rows.length === 0 ? 'Hakuna wanachama' : 'Hakuna matokeo yanayolingana'}
            message={rows.length === 0 ? 'Hakuna wanachama hai.' : 'Jaribu utafutaji au kichujio kingine.'}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(r => (
              <button
                key={r.member_id}
                onClick={() => setSelectedMember(r)}
                className={`card p-4 text-left transition-shadow hover:shadow-md ${
                  selectedMember?.member_id === r.member_id ? 'ring-2 ring-primary' : ''
                }`}
              >
                {/* Identity */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-text truncate">{r.profile?.full_name ?? 'Hajulikani'}</p>
                    <p className="text-xs text-text-secondary truncate">
                      {r.profile?.phone_number}{(r.profile?.city || r.profile?.region) && ` · ${[r.profile?.city, r.profile?.region].filter(Boolean).join(', ')}`}
                    </p>
                  </div>
                  <AggregateBadge status={r.payment_status} />
                </div>

                {/* Money summary */}
                <dl className="grid grid-cols-3 gap-2 mt-3 text-center text-xs">
                  <div className="rounded-lg bg-border-light/40 py-1.5">
                    <dt className="text-text-secondary text-[10px] uppercase font-semibold">Kinachohitajika</dt>
                    <dd className="font-semibold text-text">{formatTZS(r.required_amount)}</dd>
                  </div>
                  <div className="rounded-lg bg-border-light/40 py-1.5">
                    <dt className="text-text-secondary text-[10px] uppercase font-semibold">Kilicholipwa</dt>
                    <dd className="font-semibold text-success">{formatTZS(r.total_paid)}</dd>
                  </div>
                  <div className="rounded-lg bg-border-light/40 py-1.5">
                    <dt className="text-text-secondary text-[10px] uppercase font-semibold">{r.overpaid_amount > 0 ? 'Lilizidi' : 'Kilichobaki'}</dt>
                    <dd className={`font-semibold ${r.overpaid_amount > 0 ? 'text-primary' : 'text-error'}`}>
                      {formatTZS(r.overpaid_amount > 0 ? r.overpaid_amount : r.remaining_amount)}
                    </dd>
                  </div>
                </dl>

                {/* Dynamic progress bar */}
                <div className="mt-3">
                  <PaymentProgressBar percent={Number(r.progress_percent)} />
                </div>

                <p className="text-[11px] text-text-secondary mt-2">
                  Malipo {r.payment_count}
                  {r.last_payment_date && ` · la mwisho ${formatDate(r.last_payment_date)}`}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Step 3 — Member payment detail */}
      <Modal open={!!selectedMember} title="Rekodi za Malipo" onClose={() => setSelectedMember(null)} wide>
        {selectedMember && selectedContribution && (
          <MemberPaymentDetail
            member={selectedMember}
            contribution={selectedContribution}
            onAddPayment={() => setAddPayOpen(true)}
            onChanged={() => {
              void loadRows()
            }}
          />
        )}
      </Modal>

      {/* Add payment modal */}
      <AddPaymentModal
        open={addPayOpen && !!selectedMember && !!selectedContribution}
        member={selectedMember}
        contribution={selectedContribution}
        onClose={() => setAddPayOpen(false)}
        onRecorded={() => {
          setAddPayOpen(false)
          toast.showToast('Malipo yamerekodiwa kwa mafanikio.')
          void loadRows()
        }}
      />
    </div>
  )
}

/* ---------------- Member payment detail ---------------- */

type PaymentTxn = {
  payment_id: string
  amount: number
  payment_date: string | null
  payment_method: string | null
  transaction_reference: string | null
}

function MemberPaymentDetail({
  member,
  contribution,
  onAddPayment,
  onChanged,
}: {
  member: ContributionMemberRow
  contribution: ContributionWithStats
  onAddPayment: () => void
  onChanged: () => void
}) {
  const [txns, setTxns] = useState<PaymentTxn[]>([])
  const [loadingTxns, setLoadingTxns] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoadingTxns(true)
    void listPayments({ memberId: member.member_id, contributionId: contribution.contribution_id, pageSize: 100 }).then(({ payments }) => {
      if (!cancelled) {
        setTxns(payments.map(p => ({
          payment_id: p.payment_id,
          amount: Number(p.amount),
          payment_date: p.payment_date,
          payment_method: p.payment_method,
          transaction_reference: p.transaction_reference,
        })))
        setLoadingTxns(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [member.member_id, contribution.contribution_id, member.total_paid])

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div className="rounded-xl bg-border-light/40 p-3.5">
          <p className="text-[10px] font-bold tracking-wider text-text-secondary uppercase mb-1.5">Mwanachama</p>
          <p className="font-semibold text-text">{member.profile?.full_name}</p>
          <p className="text-xs text-text-secondary mt-0.5">{member.profile?.phone_number}</p>
          <p className="text-xs text-text-secondary">{[member.profile?.city, member.profile?.region].filter(Boolean).join(', ')}</p>
        </div>
        <div className="rounded-xl bg-border-light/40 p-3.5">
          <p className="text-[10px] font-bold tracking-wider text-text-secondary uppercase mb-1.5">Mchango</p>
          <p className="font-semibold text-text truncate">{contribution.title}</p>
          <p className="text-xs text-text-secondary mt-0.5">Kinachohitajika {formatTZS(member.required_amount)}</p>
          <p className="text-xs text-text-secondary">Inaisha {formatDate(member.due_date)}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="rounded-xl border border-border-light p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <AggregateBadge status={member.payment_status} />
          <div className="flex gap-4 text-sm">
            <span className="text-text-secondary">Kilicholipwa <strong className="text-success">{formatTZS(member.total_paid)}</strong></span>
            {member.remaining_amount > 0 && (
              <span className="text-text-secondary">Kilichobaki <strong className="text-error">{formatTZS(member.remaining_amount)}</strong></span>
            )}
            {member.overpaid_amount > 0 && (
              <span className="text-text-secondary">Lilizidi <strong className="text-primary">{formatTZS(member.overpaid_amount)}</strong></span>
            )}
          </div>
        </div>
        <div className="mt-3">
          <PaymentProgressBar percent={Number(member.progress_percent)} height="h-3" />
        </div>
      </div>

      {/* Transaction history */}
      <section aria-label="Historia ya malipo">
        <h4 className="font-semibold text-text mb-2">Historia ya Malipo ({txns.length})</h4>
        {loadingTxns ? (
          <Loading />
        ) : txns.length === 0 ? (
          <EmptyState title="Hakuna malipo yaliyorekodiwa bado." message="Tumia “Ongeza Malipo” kurekodi la kwanza." />
        ) : (
          <ol className="border border-border rounded-xl divide-y divide-border-light max-h-56 overflow-y-auto">
            {[...txns].reverse().map((t, i) => (
              <li key={t.payment_id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-text">
                    Malipo {txns.length - i} · {formatTZS(t.amount)}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {t.payment_date ? formatDate(t.payment_date) : '—'}{t.payment_method ? ` · ${t.payment_method}` : ''}{t.transaction_reference ? ` · ${t.transaction_reference}` : ''}
                  </p>
                </div>
                <span className="badge border bg-success-50 text-success border-success/20 shrink-0">
                  <span aria-hidden className="mr-1">✓</span>Imelipwa
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <button
        className="btn btn-primary w-full"
        onClick={onAddPayment}
        disabled={contribution.status !== 'OPEN'}
        title={contribution.status !== 'OPEN' ? 'Mchango huu umefungwa' : undefined}
      >
        + Ongeza Malipo
      </button>
      {contribution.status !== 'OPEN' && (
        <p className="text-xs text-error -mt-3">Mchango huu umefungwa — malipo mengine hayawezi kuongezwa.</p>
      )}

      {/* keep onChanged referenced for future refresh hooks */}
      <span hidden>{typeof onChanged}</span>
    </div>
  )
}

/* ---------------- Add payment form ---------------- */

function AddPaymentModal({
  open,
  member,
  contribution,
  onClose,
  onRecorded,
}: {
  open: boolean
  member: ContributionMemberRow | null
  contribution: ContributionWithStats | null
  onClose: () => void
  onRecorded: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [method, setMethod] = useState(PAYMENT_METHODS[0])
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && member) {
      // Suggest the remaining amount; admin may pay less, exact, or more.
      const remaining = Number(member.remaining_amount)
      setAmount(String(remaining > 0 ? remaining : Number(member.required_amount)))
      setDate(today)
      setMethod(PAYMENT_METHODS[0])
      setReference('')
      setError('')
    }
  }, [open, member, today])

  if (!member || !contribution) return null

  const submit = async () => {
    setError('')
    const amt = Number(amount)
    if (!amt || amt <= 0) return setError('Tafadhali weka kiasi sahihi kinachozidi sifuri.')
    setSaving(true)
    const { error: err } = await recordPayment({
      member_id: member.member_id,
      contribution_id: contribution.contribution_id,
      amount: amt,
      payment_date: date,
      payment_method: method,
      transaction_reference: reference,
    })
    setSaving(false)
    if (err) setError(friendlyError(err))
    else onRecorded()
  }

  return (
    <Modal open={open} title={`Ongeza Malipo — ${member.profile?.full_name ?? ''}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={e => {
          e.preventDefault()
          void submit()
        }}
      >
        <div className="rounded-xl bg-border-light/40 p-3.5 text-sm grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] font-bold tracking-wider text-text-secondary uppercase">Kinachohitajika</p>
            <p className="font-semibold text-text">{formatTZS(member.required_amount)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-wider text-text-secondary uppercase">Kilicholipwa hadi sasa</p>
            <p className="font-semibold text-success">{formatTZS(member.total_paid)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-wider text-text-secondary uppercase">{member.overpaid_amount > 0 ? 'Lilizidi' : 'Kilichobaki'}</p>
            <p className={`font-semibold ${member.overpaid_amount > 0 ? 'text-primary' : 'text-error'}`}>
              {formatTZS(member.overpaid_amount > 0 ? member.overpaid_amount : member.remaining_amount)}
            </p>
          </div>
        </div>
        <p className="text-xs text-text-secondary -mt-1">
          Mwanachama anaweza kulipa chini ya, sawa na, au zaidi ya kiasi kinachohitajika. Hali husasisha kiotomatiki.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="ap-amount">Kiasi (TZS) *</label>
            <input id="ap-amount" className="input" type="number" min="1" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="ap-date">Tarehe ya Malipo *</label>
            <input id="ap-date" className="input" type="date" value={date} onChange={e => setDate(e.target.value)} required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="ap-method">Njia ya Malipo</label>
            <select id="ap-method" className="input" value={method} onChange={e => setMethod(e.target.value)}>
              {PAYMENT_METHODS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="ap-ref">Namba ya Rejea</label>
            <input id="ap-ref" className="input" value={reference} onChange={e => setReference(e.target.value)} placeholder="Hiari" />
          </div>
        </div>
        {error && <p className="text-error text-sm">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Ghairi</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Inarekodi…' : 'Rekodi Malipo'}
          </button>
        </div>
      </form>
    </Modal>
  )
}