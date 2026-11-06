import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'
import {
  getContributionMemberStatuses,
  listReportContributions,
  type ContributionMemberRow,
} from '../../services/contributions'
import type { Contribution } from '../../types'
import { formatDate, formatTZS } from '../../utils/format'
import { exportContributionPdf } from '../../utils/contribution-pdf'
import EmptyState from '../../components/ui/EmptyState'
import Loading from '../../components/ui/Loading'
import {
  CollectionProgressChart,
  DistributionChart,
  MemberBarChart,
  type ChartPoint,
  type ChartSlice,
} from '../../components/ui/ReportCharts'

type PaymentFilter = '' | 'COMPLETED' | 'PARTIAL' | 'UNPAID'

const STATUS_COLORS = {
  completed: '#176b4a',
  partial: '#83ad8d',
  unpaid: '#c5d5c8',
}

export default function AdminReports() {
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [rows, setRows] = useState<ContributionMemberRow[]>([])
  const [loadingContributions, setLoadingContributions] = useState(true)
  const [loadingRows, setLoadingRows] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<PaymentFilter>('')
  const requestId = useRef(0)

  const loadContributions = useCallback(async () => {
    const result = await listReportContributions()
    if (result.error) {
      console.error('Failed to load report contributions', result.error)
      setError('Imeshindikana kupakia orodha ya michango.')
    } else {
      setContributions(result.contributions)
      setSelectedId(current => (
        result.contributions.some(contribution => contribution.contribution_id === current)
          ? current
          : result.contributions[0]?.contribution_id ?? ''
      ))
      setError('')
    }
    setLoadingContributions(false)
  }, [])

  const loadSelectedReport = useCallback(async () => {
    const currentRequest = ++requestId.current
    if (!selectedId) {
      setRows([])
      setLoadingRows(false)
      return
    }

    setLoadingRows(true)
    const result = await getContributionMemberStatuses(selectedId)
    if (currentRequest !== requestId.current) return
    if (result.error) {
      console.error('Failed to load selected contribution report', result.error)
      setError('Imeshindikana kupakia ripoti ya mchango huu.')
    } else {
      setRows(result.rows)
      setError('')
    }
    setLoadingRows(false)
  }, [selectedId])

  useEffect(() => { void loadContributions() }, [loadContributions])
  useEffect(() => { void loadSelectedReport() }, [loadSelectedReport])

  useRealtimeRefresh(true, 'admin-report-contributions', [
    { table: 'contributions', event: '*' },
  ], loadContributions)
  useRealtimeRefresh(!!selectedId, `admin-report-${selectedId}`, [
    { table: 'payments', event: '*', filter: `contribution_id=eq.${selectedId}` },
    { table: 'profiles', event: '*' },
    { table: 'contributions', event: '*' },
  ], loadSelectedReport)

  const selectedContribution = contributions.find(contribution => contribution.contribution_id === selectedId) ?? null
  const analytics = useMemo(() => {
    const completed = rows.filter(row => row.payment_status === 'COMPLETED').length
    const partial = rows.filter(row => row.payment_status === 'PARTIAL').length
    const unpaid = rows.filter(row => Number(row.total_paid) <= 0).length
    const expected = rows.reduce((sum, row) => sum + Number(row.required_amount), 0)
    const collected = rows.reduce((sum, row) => sum + Number(row.total_paid), 0)
    const outstanding = rows.reduce((sum, row) => sum + Number(row.remaining_amount), 0)
    const completionPercent = expected > 0 ? Math.min(100, Math.round((collected / expected) * 100)) : 0
    return { completed, partial, unpaid, expected, collected, outstanding, completionPercent }
  }, [rows])

  const statusSlices: ChartSlice[] = [
    { label: 'Imelipwa kikamilifu', value: analytics.completed, color: STATUS_COLORS.completed },
    { label: 'Imelipwa kwa sehemu', value: analytics.partial, color: STATUS_COLORS.partial },
    { label: 'Haijalipwa', value: analytics.unpaid, color: STATUS_COLORS.unpaid },
  ]
  const paymentPoints = useMemo<ChartPoint[]>(() => rows
    .map(row => ({ label: row.profile?.full_name ?? 'Mwanachama', value: Number(row.total_paid) }))
    .sort((a, b) => b.value - a.value), [rows])
  const participationPoints = useMemo<ChartPoint[]>(() => rows
    .map(row => ({
      label: row.profile?.full_name ?? 'Mwanachama',
      value: Number(row.progress_percent),
    }))
    .sort((a, b) => b.value - a.value), [rows])

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase()
    return rows.filter(row => {
      const matchesSearch = !normalizedSearch
        || (row.profile?.full_name ?? '').toLocaleLowerCase().includes(normalizedSearch)
      const matchesStatus = !statusFilter
        || (statusFilter === 'UNPAID'
          ? Number(row.total_paid) <= 0
          : row.payment_status === statusFilter)
      return matchesSearch && matchesStatus
    })
  }, [rows, search, statusFilter])

  const handleExport = () => {
    if (!selectedContribution || loadingRows) return
    exportContributionPdf({
      ...selectedContribution,
      total_members: rows.length,
      completed_members: analytics.completed,
      partial_members: analytics.partial,
      pending_members: 0,
      unpaid_members: analytics.unpaid,
      total_collected: analytics.collected,
      completion_percent: analytics.completionPercent,
    }, rows)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.15em] text-primary">Usimamizi na ufuatiliaji</p>
          <h1 className="mt-1 text-2xl font-bold text-text sm:text-3xl">Ripoti za michango</h1>
          <p className="mt-1 text-sm text-text-secondary">Chagua mchango mmoja kuona takwimu na malipo yake pekee.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => void loadContributions()}>↻ Sasisha ripoti</button>
          <button type="button" className="btn btn-primary" onClick={handleExport} disabled={!selectedContribution || loadingRows}>↓ Hifadhi PDF</button>
        </div>
      </header>

      <section className="card p-4 sm:p-5">
        <label htmlFor="report-contribution" className="text-sm font-semibold text-text">Chagua mchango</label>
        <select
          id="report-contribution"
          className="input mt-2"
          value={selectedId}
          onChange={event => {
            setSelectedId(event.target.value)
            setRows([])
            setSearch('')
            setStatusFilter('')
          }}
          disabled={loadingContributions || contributions.length === 0}
        >
          {contributions.length === 0
            ? <option value="">Hakuna michango iliyoundwa</option>
            : contributions.map(contribution => (
              <option key={contribution.contribution_id} value={contribution.contribution_id}>
                {contribution.title} · {formatDate(contribution.created_at)}
              </option>
            ))}
        </select>
      </section>

      {loadingContributions ? <Loading full /> : error ? (
        <EmptyState title={error} message="Jaribu kusasisha ripoti. Thibitisha kuwa akaunti yako ina ruhusa ya msimamizi." />
      ) : !selectedContribution ? (
        <EmptyState title="Hakuna michango bado" message="Michango iliyoundwa na msimamizi itaonekana hapa." />
      ) : (
        <>
          <section className="card space-y-4 p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-text">{selectedContribution.title}</h2>
                <p className="mt-1 max-w-3xl whitespace-pre-wrap text-sm text-text-secondary">
                  {selectedContribution.description || 'Hakuna maelezo yaliyowekwa.'}
                </p>
              </div>
              <span className={`badge ${selectedContribution.status === 'OPEN' ? 'bg-success-50 text-success' : 'bg-background text-text-secondary'}`}>
                {selectedContribution.status === 'OPEN' ? 'Wazi' : 'Imefungwa'}
              </span>
            </div>
            <div className="grid gap-3 border-t border-border-light pt-4 text-sm sm:grid-cols-3">
              <p><span className="text-text-secondary">Tarehe ya kuundwa: </span><strong className="text-text">{formatDate(selectedContribution.created_at)}</strong></p>
              <p><span className="text-text-secondary">Tarehe ya kufunguliwa: </span><strong className="text-text">{formatDate(selectedContribution.opening_date)}</strong></p>
              <p><span className="text-text-secondary">Tarehe ya mwisho: </span><strong className="text-text">{formatDate(selectedContribution.due_date)}</strong></p>
            </div>
          </section>

          {loadingRows ? <Loading full /> : (
            <>
              <section aria-label="Muhtasari wa mchango uliochaguliwa" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Wanachama wanaotarajiwa" value={String(rows.length)} note="Wanachama walio hai" />
                <Metric label="Wamelipa kikamilifu" value={String(analytics.completed)} note={`${analytics.partial} wamelipa kwa sehemu · ${analytics.unpaid} hawajalipa`} />
                <Metric label="Jumla inayotarajiwa" value={formatTZS(analytics.expected)} note="Kiasi cha mchango kwa wanachama wote" />
                <Metric label="Imekusanywa" value={formatTZS(analytics.collected)} note="Malipo yaliyothibitishwa ya mchango huu" />
                <Metric label="Salio linalodaiwa" value={formatTZS(analytics.outstanding)} note="Kiasi kilichobaki kukusanywa" />
                <Metric label="Maendeleo ya makusanyo" value={`${analytics.completionPercent}%`} note="Kiasi kilichokusanywa dhidi ya lengo" />
              </section>

              <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <article className="card min-w-0 p-4 sm:p-6">
                  <h2 className="section-title mb-5">Hali ya malipo ya wanachama</h2>
                  <DistributionChart slices={statusSlices} />
                </article>
                <article className="card min-w-0 p-4 sm:p-6">
                  <h2 className="section-title mb-2">Maendeleo ya makusanyo</h2>
                  <p className="mb-5 text-xs text-text-secondary">Kiasi kilichokusanywa ikilinganishwa na jumla inayotarajiwa.</p>
                  <CollectionProgressChart
                    collected={analytics.collected}
                    expected={analytics.expected}
                    outstanding={analytics.outstanding}
                  />
                </article>
                <article className="card min-w-0 p-4 sm:p-6">
                  <h2 className="section-title mb-2">Ushiriki wa wanachama</h2>
                  <p className="mb-4 text-xs text-text-secondary">Asilimia ya kiasi kinachohitajika iliyolipwa na kila mwanachama.</p>
                  <MemberBarChart points={participationPoints} format="percent" />
                </article>
              </section>

              <section className="card min-w-0 p-4 sm:p-6">
                <h2 className="section-title mb-2">Malipo kwa kila mwanachama</h2>
                <p className="mb-4 text-xs text-text-secondary">Jumla ya malipo yaliyothibitishwa kwa mchango uliochaguliwa.</p>
                <MemberBarChart points={paymentPoints} />
              </section>

              <section className="card overflow-hidden">
                <div className="flex flex-col gap-4 border-b border-border-light p-4 sm:p-5">
                  <div>
                    <h2 className="section-title">Maelezo ya malipo ya wanachama</h2>
                    <p className="mt-1 text-xs text-text-secondary">Kiasi kinachohitajika, jumla ya malipo yote, salio, hali na tarehe za malipo.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-semibold text-text-secondary">Tafuta mwanachama
                      <input className="input mt-1" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Andika jina..." />
                    </label>
                    <label className="text-xs font-semibold text-text-secondary">Chuja kwa hali
                      <select className="input mt-1" value={statusFilter} onChange={event => setStatusFilter(event.target.value as PaymentFilter)}>
                        <option value="">Hali zote</option>
                        <option value="COMPLETED">Imelipwa kikamilifu</option>
                        <option value="PARTIAL">Imelipwa kwa sehemu</option>
                        <option value="UNPAID">Haijalipwa</option>
                      </select>
                    </label>
                  </div>
                </div>
                {filteredRows.length === 0 ? (
                  <div className="p-5">
                    <EmptyState
                      title={rows.length === 0 ? 'Hakuna wanachama wa kuripoti' : 'Hakuna wanachama wanaolingana'}
                      message={rows.length === 0 ? 'Wanachama walio hai wataonekana baada ya kujiunga.' : 'Badilisha utafutaji au kichujio cha hali.'}
                    />
                  </div>
                ) : (
                  <div className="max-h-[36rem] overflow-auto">
                    <table className="w-full min-w-[850px] text-left text-sm">
                      <thead className="sticky top-0 bg-background text-xs uppercase tracking-wide text-text-secondary">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Mwanachama</th>
                          <th className="px-4 py-3 text-right font-semibold">Kinachohitajika</th>
                          <th className="px-4 py-3 text-right font-semibold">Kilicholipwa</th>
                          <th className="px-4 py-3 text-right font-semibold">Salio</th>
                          <th className="px-4 py-3 font-semibold">Hali</th>
                          <th className="px-4 py-3 font-semibold">Tarehe za malipo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-light">
                        {filteredRows.map(row => (
                          <tr key={row.member_id}>
                            <td className="px-4 py-3 font-medium text-text">{row.profile?.full_name ?? 'Mwanachama'}</td>
                            <td className="px-4 py-3 text-right text-text-secondary">{formatTZS(row.required_amount)}</td>
                            <td className="px-4 py-3 text-right font-semibold text-success">{formatTZS(row.total_paid)}</td>
                            <td className="px-4 py-3 text-right text-text-secondary">{formatTZS(row.remaining_amount)}</td>
                            <td className="px-4 py-3"><StatusBadge status={row.payment_status} /></td>
                            <td className="max-w-64 px-4 py-3 text-xs text-text-secondary">
                              {row.payment_dates.length > 0 ? row.payment_dates.map(formatDate).join(', ') : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="border-t border-border-light px-4 py-3 text-xs text-text-secondary">
                  Inaonyesha wanachama {filteredRows.length} kati ya {rows.length} wa mchango huu.
                </p>
              </section>
            </>
          )}
        </>
      )}
    </div>
  )
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="card min-w-0 p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</p>
      <p className="mt-2 break-words text-xl font-bold tracking-tight text-text sm:text-2xl">{value}</p>
      <p className="mt-1 text-xs text-text-secondary">{note}</p>
    </article>
  )
}

function StatusBadge({ status }: { status: ContributionMemberRow['payment_status'] }) {
  if (status === 'COMPLETED') return <span className="badge bg-success-50 text-success">Imelipwa kikamilifu</span>
  if (status === 'PARTIAL') return <span className="badge bg-warning-50 text-warning">Imelipwa kwa sehemu</span>
  return <span className="badge bg-error-50 text-error">Haijalipwa</span>
}
