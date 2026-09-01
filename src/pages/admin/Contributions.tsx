import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  listContributions,
  createContribution,
  closeContribution,
  getContributionMemberStatuses,
  type ContributionWithStats,
} from '../../services/contributions'
import { exportContributionPdf } from '../../utils/contribution-pdf'
import { useDebounce } from '../../hooks/useDebounce'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'
import { formatTZS, formatTZSCompact, formatDate } from '../../utils/format'
import { friendlyError } from '../../utils/errors'
import EmptyState from '../../components/ui/EmptyState'
import Loading from '../../components/ui/Loading'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { useToast } from '../../components/ui/Toast'

type Tab = 'ALL' | 'OPEN' | 'CLOSED'

/**
 * Contributions management — create, view, filter, inspect, close and
 * export reports. Payment assignment lives exclusively in the Payments section.
 */
export default function AdminContributions() {
  const toast = useToast()
  const [contributions, setContributions] = useState<ContributionWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('ALL')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)

  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [closeTarget, setCloseTarget] = useState<ContributionWithStats | null>(null)
  const [closing, setClosing] = useState(false)
  const [exportingId, setExportingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { contributions: data } = await listContributions()
    setContributions(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Live updates: contribution and payment changes appear automatically.
  useRealtimeRefresh(true, 'admin-contributions', [
    { table: 'contributions', event: '*' },
    { table: 'payments', event: '*' },
  ], load)

  const filtered = useMemo(() => {
    let rows = tab === 'ALL' ? contributions : contributions.filter(c => c.status === tab)
    if (debouncedSearch.trim()) {
      const term = debouncedSearch.trim().toLowerCase()
      rows = rows.filter(c => c.title.toLowerCase().includes(term))
    }
    return rows
  }, [contributions, tab, debouncedSearch])

  const detail = detailId ? contributions.find(c => c.contribution_id === detailId) ?? null : null

  const handleClose = async () => {
    if (!closeTarget) return
    setClosing(true)
    const { error } = await closeContribution(closeTarget.contribution_id)
    setClosing(false)
    if (error) {
      toast.showToast(friendlyError(error), 'error')
    } else {
      toast.showToast('Mchango umefungwa kwa mafanikio.')
      setCloseTarget(null)
      void load()
    }
  }

  const handleExport = async (c: ContributionWithStats) => {
    setExportingId(c.contribution_id)
    try {
      const { rows } = await getContributionMemberStatuses(c.contribution_id)
      exportContributionPdf(c, rows)
      toast.showToast('Ripoti ya PDF imetengenezwa.')
    } catch {
      toast.showToast('Imeshindikana kutengeneza PDF. Tafadhali jaribu tena.', 'error')
    } finally {
      setExportingId(null)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">Michango</h1>
          <p className="text-text-secondary text-sm mt-0.5">Tengeneza na simamia michango. Kurekodi malipo kunafanywa katika Malipo.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
          + Ongeza Mchango
        </button>
      </div>

      {/* Tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex gap-2" role="tablist" aria-label="Chuja kwa hali">
          {(['ALL', 'OPEN', 'CLOSED'] as Tab[]).map(t => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`badge border px-4 py-1.5 cursor-pointer transition-colors ${
                tab === t ? 'bg-primary text-white border-primary' : 'bg-surface text-text-secondary border-border hover:bg-border-light'
              }`}
            >
              {t === 'ALL'
                ? `Zote (${contributions.length})`
                : t === 'OPEN'
                  ? `Wazi (${contributions.filter(c => c.status === t).length})`
                  : `Imefungwa (${contributions.filter(c => c.status === t).length})`}
            </button>
          ))}
        </div>
        <input
          type="search"
          className="input sm:max-w-xs sm:ml-auto"
          placeholder="Tafuta michango…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Tafuta michango"
        />
      </div>

      {/* Cards */}
      {loading ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={contributions.length === 0 ? 'Hakuna michango bado' : 'Hakuna matokeo yanayolingana'}
          message={contributions.length === 0 ? 'Tengeneza mchango wako wa kwanza kuanza.' : 'Jaribu utafutaji mwingine.'}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {filtered.map(c => (
            <article key={c.contribution_id} className="card p-4 sm:p-5 flex flex-col gap-3">
              {/* Title + status */}
              <div className="flex items-start justify-between gap-3">
                <button className="text-left min-w-0" onClick={() => setDetailId(c.contribution_id)}>
                  <h3 className="font-semibold text-text hover:text-primary transition-colors">{c.title}</h3>
                  {c.description && <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{c.description}</p>}
                </button>
                {/* Status visible directly on the card */}
                <span
                  className={`badge border shrink-0 ${
                    c.status === 'OPEN'
                      ? 'bg-success-50 text-success border-success/20'
                      : 'bg-error-50 text-error border-error/20'
                  }`}
                >
                  <span aria-hidden className="mr-1">{c.status === 'OPEN' ? '●' : '■'}</span>
                  {c.status === 'OPEN' ? 'Wazi' : 'Imefungwa'}
                </span>
              </div>

              {/* Key facts */}
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs">
                <div>
                  <dt className="text-text-secondary">Kinachohitajika</dt>
                  <dd className="font-bold text-primary text-sm">{formatTZS(c.amount)}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">Inafunguka</dt>
                  <dd className="font-medium text-text">{formatDate(c.opening_date)}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">Inafunga</dt>
                  <dd className="font-medium text-text">{formatDate(c.due_date)}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">Yaliyokusanywa</dt>
                  <dd className="font-medium text-success">{formatTZSCompact(c.total_collected)}</dd>
                </div>
              </dl>

              {/* Member payment breakdown */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <MiniCount label="Wanachama" value={c.total_members} />
                <MiniCount label="DONE" value={c.completed_members} tone="success" />
                <MiniCount label="Kiasi" value={c.partial_members} tone="warning" />
                <MiniCount label="Hawajalipa" value={c.unpaid_members + c.pending_members} tone="error" />
              </div>

              {/* Actions — Export to PDF bottom-right */}
              <div className="flex items-center gap-2 pt-1 mt-auto">
                <button className="btn btn-ghost btn-sm" onClick={() => setDetailId(c.contribution_id)}>
                  Maelezo
                </button>
                {c.status === 'OPEN' && (
                  <button className="btn btn-ghost btn-sm !text-warning" onClick={() => setCloseTarget(c)}>
                    Funga
                  </button>
                )}
                <button
                  className="btn btn-secondary btn-sm ml-auto"
                  onClick={() => void handleExport(c)}
                  disabled={exportingId === c.contribution_id}
                >
                  {exportingId === c.contribution_id ? 'Inatengeneza…' : '⬇ Hifadhi PDF'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Create modal */}
      <CreateContributionModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false)
          toast.showToast('Mchango umeongezwa kwa mafanikio.')
          void load()
        }}
      />

      {/* Detail modal */}
      <Modal open={!!detail} title={detail?.title ?? ''} onClose={() => setDetailId(null)}>
        {detail && (
          <div className="space-y-4">
            {detail.description && <p className="text-sm text-text-secondary">{detail.description}</p>}
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Info label="Kiasi Kinachohitajika" value={formatTZS(detail.amount)} />
              <Info label="Hali" value={detail.status === 'OPEN' ? 'Wazi' : 'Imefungwa'} />
              <Info label="Tarehe ya Kufunguka" value={formatDate(detail.opening_date)} />
              <Info label="Tarehe ya Kufunga" value={formatDate(detail.due_date)} />
              <Info label="Wanachama Wote" value={String(detail.total_members)} />
              <Info label="DONE" value={String(detail.completed_members)} />
              <Info label="DONE Kiasi" value={String(detail.partial_members)} />
              <Info label="Hawajalipa / Wanasubiri" value={String(detail.unpaid_members + detail.pending_members)} />
              <Info label="Jumla Yaliyokusanywa" value={formatTZS(detail.total_collected)} />
              <Info label="Ukamilifu" value={`${detail.completion_percent}%`} />
            </dl>
            <p className="text-xs text-text-secondary border-t border-border-light pt-3">
              Kurekodi au kuongeza malipo ya wanachama, fungua sehemu ya <strong>Malipo</strong>.
            </p>
            <button
              className="btn btn-secondary w-full"
              onClick={() => detail && void handleExport(detail)}
              disabled={exportingId === detail.contribution_id}
            >
              ⬇ Hifadhi PDF
            </button>
          </div>
        )}
      </Modal>

      {/* Close confirmation */}
      <ConfirmDialog
        open={!!closeTarget}
        loading={closing}
        title="Ufunge Mchango?"
        message={
          closeTarget && (
            <>
              Malipo mapya hayatakaribiwa tena kwa <strong>{closeTarget.title}</strong>.
              Wanachama ambao hawajakamilisha malipo yao wataarifiwa.
            </>
          )
        }
        confirmLabel="Funga Mchango"
        onConfirm={handleClose}
        onCancel={() => setCloseTarget(null)}
      />
    </div>
  )
}

function MiniCount({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'warning' | 'error' }) {
  const tones = { success: 'text-success', warning: 'text-warning', error: 'text-error' }
  return (
    <div className="rounded-xl border border-border-light bg-border-light/30 py-2 px-1">
      <p className={`font-bold ${tone ? tones[tone] : 'text-text'}`}>{value}</p>
      <p className="text-[10px] font-semibold tracking-wide text-text-secondary uppercase">{label}</p>
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

/* ---------------- Create form ---------------- */

function CreateContributionModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({ title: '', description: '', amount: '', opening_date: today, due_date: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setForm({ title: '', description: '', amount: '', opening_date: today, due_date: '' })
      setError('')
    }
  }, [open, today])

  const submit = async () => {
    setError('')
    const amount = Number(form.amount)
    if (!form.title.trim()) return setError('Tafadhali weka kichwa.')
    if (!amount || amount <= 0) return setError('Tafadhali weka kiasi sahihi kinachozidi sifuri.')
    if (!form.due_date) return setError('Tafadhali chagua tarehe ya kufunga.')
    if (form.due_date < form.opening_date) return setError('Tarehe ya kufunga haiwezi kabla ya tarehe ya kufunguka.')

    setSaving(true)
    const { error: err } = await createContribution({
      title: form.title,
      description: form.description || null,
      amount,
      opening_date: form.opening_date,
      due_date: form.due_date,
    })
    setSaving(false)
    if (err) setError(friendlyError(err))
    else onCreated()
  }

  return (
    <Modal open={open} title="Ongeza Mchango" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={e => {
          e.preventDefault()
          void submit()
        }}
      >
        <div>
          <label className="label" htmlFor="c-title">Kichwa *</label>
          <input id="c-title" className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Michango ya 2021familyforever ya Mwezi" required />
        </div>
        <div>
          <label className="label" htmlFor="c-desc">Maelezo</label>
          <textarea id="c-desc" className="input min-h-[80px]" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Maelezo ya hiari…" />
        </div>
        <div>
          <label className="label" htmlFor="c-amount">Kiasi (TZS) *</label>
          <input id="c-amount" className="input" type="number" min="1" inputMode="numeric" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="100000" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="c-open">Tarehe ya Kufunguka</label>
            <input id="c-open" className="input" type="date" value={form.opening_date} onChange={e => setForm(f => ({ ...f, opening_date: e.target.value }))} required />
          </div>
          <div>
            <label className="label" htmlFor="c-due">Tarehe ya Kufunga *</label>
            <input id="c-due" className="input" type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} required />
          </div>
        </div>
        {error && <p className="text-error text-sm">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Ghairi</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Inatengenezwa…' : 'Ongeza Mchango'}</button>
        </div>
      </form>
    </Modal>
  )
}