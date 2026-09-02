import { useCallback, useEffect, useState } from 'react'
import { supabase, type Profile } from '../../types'
import {
  listMembers,
  listRegions,
  setMemberRole,
  setMemberStatus,
  type MemberFilters,
} from '../../services/members'
import { listPayments } from '../../services/payments'
import { useDebounce } from '../../hooks/useDebounce'
import { formatDate } from '../../utils/format'
import { friendlyError } from '../../utils/errors'
import Avatar from '../../components/ui/Avatar'
import { AccountBadge, AggregateBadge, PaymentBadge, RoleBadge } from '../../components/ui/StatusBadge'
import EmptyState from '../../components/ui/EmptyState'
import Loading from '../../components/ui/Loading'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { useToast } from '../../components/ui/Toast'

type StatusFilter = 'ALL' | Profile['account_status']
type DetailTab = 'overview' | 'contributions' | 'payments' | 'account'
type ActionKind = 'role' | 'approve' | 'suspend' | 'activate' | 'delete'

const PAGE_SIZE = 20

export default function AdminMembers() {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const [status, setStatus] = useState<StatusFilter>('ALL')
  const [region, setRegion] = useState('')
  const [page, setPage] = useState(1)
  const [members, setMembers] = useState<Profile[]>([])
  const [total, setTotal] = useState(0)
  const [regions, setRegions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const [selected, setSelected] = useState<Profile | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ kind: ActionKind; member: Profile; value?: string } | null>(null)
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const filters: MemberFilters = { search: debouncedSearch || undefined, status, region: region || undefined, page, pageSize: PAGE_SIZE }
    const { members: data, total: count } = await listMembers(filters)
    setMembers(data)
    setTotal(count)
    setLoading(false)
  }, [debouncedSearch, status, region, page])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void listRegions().then(setRegions)
  }, [])

  useEffect(() => setPage(1), [debouncedSearch, status, region])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handleConfirm = async () => {
    if (!confirmAction) return
    setActing(true)
    const m = confirmAction.member
    let error: unknown = null

    if (confirmAction.kind === 'role') {
      ({ error } = await setMemberRole(m.user_id, confirmAction.value as Profile['role']))
    } else if (confirmAction.kind === 'approve') {
      ({ error } = await setMemberStatus(m.user_id, 'ACTIVE'))
    } else if (confirmAction.kind === 'suspend') {
      ({ error } = await setMemberStatus(m.user_id, 'SUSPENDED'))
    } else if (confirmAction.kind === 'activate') {
      ({ error } = await setMemberStatus(m.user_id, 'ACTIVE'))
    } else if (confirmAction.kind === 'delete') {
      ({ error } = await setMemberStatus(m.user_id, 'DELETED'))
    }

    setActing(false)
    if (error) {
      toast.showToast(friendlyError(error), 'error')
    } else {
      toast.showToast(
        confirmAction.kind === 'role'
          ? confirmAction.value === 'ADMIN'
            ? `${m.full_name} sasa ni .`
            : `${m.full_name} sasa ni mwanachama.`
          : confirmAction.kind === 'approve'
            ? `${m.full_name} ameidhinishwa. Sasa anaweza kuingia.`
            : confirmAction.kind === 'suspend'
              ? `${m.full_name} amesimamishwa.`
              : confirmAction.kind === 'activate'
                ? `${m.full_name} ameezeshwa upya.`
                : `${m.full_name} amefutwa.`
      )
      setConfirmAction(null)
      setSelected(null)
      void load()
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">Wanachama</h1>
          <p className="text-text-secondary text-sm mt-0.5">{total} wanachama wamesajiliwa</p>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="search"
            className="input pl-9"
            placeholder="Tafuta jina, simu, mkoa…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Tafuta wanachama"
          />
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <select className="input sm:w-40" value={status} onChange={e => setStatus(e.target.value as StatusFilter)} aria-label="Chuja kwa hali">
          <option value="ALL">Hali zote</option>
          <option value="PENDING">Inasubiri Idhini</option>
          <option value="ACTIVE">Hai</option>
          <option value="SUSPENDED">Imesimamishwa</option>
          <option value="DELETED"><Amefutwa></Amefutwa></option>
        </select>
        <select className="input sm:w-44" value={region} onChange={e => setRegion(e.target.value)} aria-label="Chuja kwa mkoa">
          <option value="">Mikoa yote</option>
          {regions.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <Loading />
      ) : members.length === 0 ? (
        <EmptyState
          title={total === 0 ? 'Hakuna wanachama' : 'Hakuna matokeo yanayolingana'}
          message={total === 0 ? 'Hakuna wanachama waliosajiliwa bado.' : 'Jaribu utafutaji mwingine.'}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-border-light/50 text-left text-xs text-text-secondary uppercase tracking-wide">
                  <th className="px-4 py-3 font-semibold">Mwanachama</th>
                  <th className="px-4 py-3 font-semibold">Namba ya Simu</th>
                  <th className="px-4 py-3 font-semibold">Mkoa</th>
                  <th className="px-4 py-3 font-semibold">Wadhifa</th>
                  <th className="px-4 py-3 font-semibold">Hali</th>
                  <th className="px-4 py-3 font-semibold">Alijiunga</th>
                  <th className="px-4 py-3 font-semibold text-right">Vitendo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {members.map(m => (
                  <tr key={m.user_id} className="hover:bg-border-light/40 cursor-pointer" onClick={() => setSelected(m)}>
                    <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar src={m.profile_picture} name={m.full_name} className="w-8 h-8 text-xs" />
                          <span className="font-medium text-text">{m.full_name}</span>
                        </div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{m.phone_number}</td>
                    <td className="px-4 py-3 text-text-secondary">{m.region || '—'}</td>
                    <td className="px-4 py-3"><RoleBadge role={m.role} /></td>
                    <td className="px-4 py-3"><AccountBadge status={m.account_status} /></td>
                    <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{formatDate(m.created_at)}</td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <MemberActions member={m} onAction={setConfirmAction} compact />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {members.map(m => (
              <button key={m.user_id} onClick={() => setSelected(m)} className="card p-4 w-full text-left">
                <div className="flex items-center gap-3">
                  <Avatar src={m.profile_picture} name={m.full_name} className="w-10 h-10 text-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-text truncate">{m.full_name}</p>
                    <p className="text-xs text-text-secondary">{m.phone_number} · {m.region || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <RoleBadge role={m.role} />
                  <AccountBadge status={m.account_status} />
                  <span className="text-xs text-text-secondary ml-auto">{formatDate(m.created_at)}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-2 pt-2" aria-label="Kurasa">
              <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Nyuma</button>
              <span className="text-sm text-text-secondary px-2">Ukurasa {page} kati ya {totalPages}</span>
              <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Mbele →</button>
            </nav>
          )}
        </>
      )}

      {/* Member details */}
      <Modal open={!!selected} title="Maelezo ya Mwanachama" onClose={() => setSelected(null)} wide>
        {selected && <MemberDetail member={selected} onAction={setConfirmAction} />}
      </Modal>

      {/* Confirmations */}
      <ConfirmDialog
        open={!!confirmAction}
        loading={acting}
        danger={confirmAction?.kind === 'delete' || confirmAction?.kind === 'suspend'}
        title={
          confirmAction?.kind === 'role'
            ? confirmAction.value === 'ADMIN' ? 'Amfanye ?' : 'Amshushe Kuwa Mwanachama?'
            : confirmAction?.kind === 'approve'
              ? 'Umidhinishe Mwanachama?'
              : confirmAction?.kind === 'suspend'
                ? 'Am-simamishe Mwanachama?'
                : confirmAction?.kind === 'activate'
                  ? 'Amwezeshe Mwanachama?'
                  : 'Amfute Mwanachama?'
        }
        message={
          confirmAction?.kind === 'role'
            ? `${confirmAction.member.full_name} ${confirmAction.value === 'ADMIN' ? 'atapata uwezo kamili wa usimamizi.' : 'hatakuwa na uwezo wa usimamizi tena.'}`
            : confirmAction?.kind === 'approve'
              ? `${confirmAction.member.full_name} ataruhusiwa kuingia kwenye programu hii mara moja.`
              : confirmAction?.kind === 'suspend'
                ? `${confirmAction.member.full_name} hataweza tena kuingia kwenye programu hii.`
                : confirmAction?.kind === 'activate'
                  ? `${confirmAction.member.full_name} ataruhusiwa tena kuingia kwenye programu hii.`
                  : `${confirmAction?.member.full_name} hataweza tena kuingia kwenye programu hii.`
        }
        confirmLabel={
          confirmAction?.kind === 'role'
            ? confirmAction.value === 'ADMIN' ? 'Fanya ' : 'Shusha Kuwa Mwanachama'
            : confirmAction?.kind === 'approve'
              ? 'Idhinisha'
              : confirmAction?.kind === 'suspend'
                ? 'Simamisha'
                : confirmAction?.kind === 'activate'
                  ? 'Wezesha'
                  : 'Futa'
        }
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  )
}

function MemberActions({
  member,
  onAction,
  compact = false,
}: {
  member: Profile
  onAction: (a: { kind: ActionKind; member: Profile; value?: string }) => void
  compact?: boolean
}) {
  const size = compact ? 'btn-sm' : ''
  return (
    <div className={`flex gap-1.5 ${compact ? 'justify-end' : ''}`}>
      {member.account_status === 'PENDING' && (
        <button className={`btn btn-ghost btn-sm ${size} !text-success`} onClick={() => onAction({ kind: 'approve', member })}>
          Idhinisha
        </button>
      )}
      {member.role === 'MEMBER' ? (
        <button className={`btn btn-ghost btn-sm ${size}`} onClick={() => onAction({ kind: 'role', member, value: 'ADMIN' })}>
          Fanya 
        </button>
      ) : (
        <button className={`btn btn-ghost btn-sm ${size}`} onClick={() => onAction({ kind: 'role', member, value: 'MEMBER' })}>
          Shusha Kuwa Mwanachama
        </button>
      )}
      {member.account_status === 'ACTIVE' && (
        <button className={`btn btn-ghost btn-sm ${size} !text-warning`} onClick={() => onAction({ kind: 'suspend', member })}>
          Simamisha
        </button>
      )}
      {(member.account_status === 'SUSPENDED' || member.account_status === 'DELETED') && (
        <button className={`btn btn-ghost btn-sm ${size} !text-success`} onClick={() => onAction({ kind: 'activate', member })}>
          Wezesha
        </button>
      )}
      {member.account_status !== 'DELETED' && (
        <button className={`btn btn-ghost btn-sm ${size} !text-error`} onClick={() => onAction({ kind: 'delete', member })}>
          Futa
        </button>
      )}
    </div>
  )
}

function MemberDetail({
  member,
  onAction,
}: {
  member: Profile
  onAction: (a: { kind: ActionKind; member: Profile; value?: string }) => void
}) {
  const TAB_LABELS: Record<DetailTab, string> = {
    overview: 'Muhtasari',
    contributions: 'Michango',
    payments: 'Malipo',
    account: 'Akaunti',
  }
  const [tab, setTab] = useState<DetailTab>('overview')
  const [contribRows, setContribRows] = useState<{ payment_status: string; title: string; required_amount: number; total_paid: number; progress_percent: number; due_date: string; last_payment_date: string | null }[]>([])
  const [paymentRows, setPaymentRows] = useState<{ payment_id: string; amount: number; payment_date: string | null; payment_method: string | null; contribution_title: string | null }[]>([])
  const [tabLoading, setTabLoading] = useState(false)

  useEffect(() => {
    setTab('overview')
  }, [member.user_id])

  useEffect(() => {
    if (tab !== 'contributions' && tab !== 'payments') return
    let cancelled = false
    setTabLoading(true)

    async function load() {
      if (tab === 'contributions') {
        const { data } = await supabase
          .from('v_member_contribution_status')
          .select('*')
          .eq('member_id', member.user_id)
          .order('due_date', { ascending: false })
        if (!cancelled) {
          setContribRows((data ?? []) as unknown as typeof contribRows)
          setTabLoading(false)
        }
      } else {
        const { payments } = await listPayments({ memberId: member.user_id, pageSize: 50 })
        if (!cancelled) {
          setPaymentRows(payments.map(p => ({
            payment_id: p.payment_id,
            amount: Number(p.amount),
            payment_date: p.payment_date,
            payment_method: p.payment_method,
            contribution_title: p.contribution?.title ?? null,
          })))
          setTabLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [tab, member.user_id])

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 pb-5 border-b border-border">
        <Avatar src={member.profile_picture} name={member.full_name} className="w-14 h-14 rounded-2xl text-lg font-bold" />
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-text truncate">{member.full_name}</h3>
          <p className="text-sm text-text-secondary">{member.phone_number} · {member.city || '—'}, {member.region || '—'}</p>
          <div className="flex gap-2 mt-1.5">
            <RoleBadge role={member.role} />
            <AccountBadge status={member.account_status} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mt-4 border-b border-border overflow-x-auto" role="tablist">
        {(['overview', 'contributions', 'payments', 'account'] as DetailTab[]).map(t => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="pt-4 min-h-[220px]">
        {tab === 'overview' && (
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <Info label="Namba ya Simu" value={member.phone_number} />
            <Info label="Alijiunga" value={formatDate(member.created_at)} />
            <Info label="Mkoa" value={member.region || '—'} />
            <Info label="Mji" value={member.city || '—'} />
          </dl>
        )}

        {tab === 'contributions' &&
          (tabLoading ? (
            <Loading />
          ) : contribRows.length === 0 ? (
            <EmptyState title="Hakuna michango bado" message="Mwanachama huyu hana rekodi za michango." />
          ) : (
            <div className="space-y-2">
              {contribRows.map((r, i) => (
                <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border-light">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text truncate">{r.title}</p>
                    <p className="text-xs text-text-secondary">Inaisha {formatDate(r.due_date)}{r.last_payment_date ? ` · Malipo ya mwisho ${formatDate(r.last_payment_date)}` : ''}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <AggregateBadge status={r.payment_status as 'PENDING' | 'UNPAID' | 'PARTIAL' | 'COMPLETED'} />
                    <span className="text-xs text-text-secondary">
                      {Number(r.total_paid).toLocaleString()} / {Number(r.required_amount).toLocaleString()} ({r.progress_percent}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ))}

        {tab === 'payments' &&
          (tabLoading ? (
            <Loading />
          ) : paymentRows.length === 0 ? (
            <EmptyState title="Hakuna rekodi za malipo." />
          ) : (
            <div className="space-y-2">
              {paymentRows.map(p => (
                <div key={p.payment_id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border-light">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text truncate">{p.contribution_title ?? 'Mchango'}</p>
                    <p className="text-xs text-text-secondary">
                      {p.payment_date ? formatDate(p.payment_date) : '—'}{p.payment_method ? ` · ${p.payment_method}` : ''}
                    </p>
                  </div>
                  <PaymentBadge status="PAID" />
                </div>
              ))}
            </div>
          ))}

        {tab === 'account' && (
          <div>
            <dl className="grid grid-cols-2 gap-4 text-sm mb-5">
              <Info label="Hali ya Akaunti" value={member.account_status} />
              <Info label="Wadhifa" value={member.role} />
            </dl>
            <MemberActions member={member} onAction={onAction} />
          </div>
        )}
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-text-secondary">{label}</dt>
      <dd className="font-medium text-text mt-0.5">{value}</dd>
    </div>
  )
}