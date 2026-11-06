import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'
import { getMemberReport } from '../../services/reports'
import type { MemberContributionStatus, Payment } from '../../types'
import { formatDate, formatTZS } from '../../utils/format'
import EmptyState from '../../components/ui/EmptyState'
import Loading from '../../components/ui/Loading'
import { ActivityChart, DistributionChart, type ChartPoint, type ChartSlice } from '../../components/ui/ReportCharts'

type ReportData = { statuses: MemberContributionStatus[]; payments: Payment[] }

const STATUS_COLORS = { paid: '#176b4a', pending: '#83ad8d', unpaid: '#c5d5c8' }

export default function MemberReports() {
  const { user } = useAuth()
  const [report, setReport] = useState<ReportData>({ statuses: [], payments: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [year, setYear] = useState(String(new Date().getFullYear()))

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    const result = await getMemberReport(user.user_id)
    if (result.error) {
      console.error('Failed to load member contribution report', result.error)
      setError('Imeshindikana kupakia taarifa zako za michango.')
    } else {
      setReport({ statuses: result.statuses, payments: result.payments })
    }
    setLoading(false)
  }, [user])

  useEffect(() => { void load() }, [load])
  useRealtimeRefresh(!!user, 'member-reports', [
    { table: 'payments', event: '*', filter: `member_id=eq.${user?.user_id ?? ''}` },
    { table: 'contributions', event: '*' },
  ], load)

  const years = useMemo(() => {
    const available = report.payments
      .filter(payment => payment.payment_status === 'PAID' && payment.payment_date)
      .map(payment => new Date(`${payment.payment_date}T00:00:00`).getFullYear())
      .filter(Number.isFinite)
    return [...new Set([new Date().getFullYear(), ...available])].sort((a, b) => b - a)
  }, [report.payments])

  const stats = useMemo(() => {
    const paid = report.statuses.filter(row => row.payment_status === 'COMPLETED').length
    const pending = report.statuses.filter(row => row.payment_status === 'PARTIAL' || row.payment_status === 'PENDING').length
    const unpaid = report.statuses.filter(row => row.payment_status === 'UNPAID').length
    const expected = report.statuses.reduce((sum, row) => sum + Number(row.required_amount), 0)
    const contributed = report.statuses.reduce((sum, row) => sum + Number(row.total_paid), 0)
    const outstanding = report.statuses.reduce((sum, row) => sum + Number(row.remaining_amount), 0)
    const completionRate = report.statuses.length ? Math.round((paid / report.statuses.length) * 100) : 0
    return { paid, pending, unpaid, expected, contributed, outstanding, completionRate }
  }, [report.statuses])

  const trend = useMemo<ChartPoint[]>(() => {
    const selectedYear = Number(year)
    return Array.from({ length: 12 }, (_, month) => {
      const monthPayments = report.payments.filter(payment => {
        if (payment.payment_status !== 'PAID' || !payment.payment_date) return false
        const date = new Date(`${payment.payment_date}T00:00:00`)
        return date.getFullYear() === selectedYear && date.getMonth() === month
      })
      return {
        label: new Intl.DateTimeFormat('sw', { month: 'short' }).format(new Date(selectedYear, month, 1)),
        value: monthPayments.reduce((sum, payment) => sum + Number(payment.amount), 0),
      }
    })
  }, [report.payments, year])
  const selectedYearTotal = useMemo(
    () => trend.reduce((sum, point) => sum + point.value, 0),
    [trend],
  )

  const slices: ChartSlice[] = [
    { label: 'Imekamilika', value: stats.paid, color: STATUS_COLORS.paid },
    { label: 'Inaendelea', value: stats.pending, color: STATUS_COLORS.pending },
    { label: 'Haijalipwa', value: stats.unpaid, color: STATUS_COLORS.unpaid },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.15em] text-primary">Taarifa binafsi</p>
          <h1 className="mt-1 text-2xl font-bold text-text sm:text-3xl">Ripoti za michango</h1>
          <p className="mt-1 text-sm text-text-secondary">Muhtasari na mwenendo wa michango yako pekee.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
          Mwaka
          <select className="input w-auto min-w-28" value={year} onChange={event => setYear(event.target.value)}>
            {years.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </header>

      {loading ? <Loading full /> : error ? (
        <EmptyState title={error} message="Jaribu kupakia upya." />
      ) : (
        <>
          <section aria-label="Muhtasari wa fedha" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Jumla uliyolipa" value={formatTZS(stats.contributed)} note="Malipo yaliyothibitishwa" />
            <Metric label="Inayotarajiwa" value={formatTZS(stats.expected)} note={`${report.statuses.length} shughuli za michango`} />
            <Metric label="Salio lililobaki" value={formatTZS(stats.outstanding)} note={`${stats.pending + stats.unpaid} bado hazijakamilika`} />
            <Metric label="Kiwango cha ukamilifu" value={`${stats.completionRate}%`} note={`${stats.paid} kati ya ${report.statuses.length} zimekamilika`} />
          </section>
          <section aria-label={`Muhtasari wa malipo ya ${year}`} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Metric label={`Jumla iliyolipwa · ${year}`} value={formatTZS(selectedYearTotal)} note="Kutokana na malipo yaliyothibitishwa katika mwaka huu" />
            <Metric label="Idadi ya malipo" value={String(report.payments.filter(payment => payment.payment_status === 'PAID' && payment.payment_date?.startsWith(`${year}-`)).length)} note={`Malipo yaliyorekodiwa mwaka ${year}`} />
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
            <article className="card min-w-0 p-4 sm:p-6">
              <div className="mb-3">
                <h2 className="section-title">Mwenendo wa malipo</h2>
                <p className="mt-1 text-xs text-text-secondary">Jumla ya malipo yaliyothibitishwa kila mwezi · {year}</p>
              </div>
              <ActivityChart points={trend} />
            </article>
            <article className="card p-4 sm:p-6">
              <h2 className="section-title mb-5">Ushiriki wa michango</h2>
              <DistributionChart slices={slices} />
            </article>
          </section>

          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border-light p-4 sm:p-6">
              <div>
                <h2 className="section-title">Historia ya michango</h2>
                <p className="mt-1 text-xs text-text-secondary">Hali ya kila shughuli na kiasi kilicholipwa.</p>
              </div>
              <Link to="/contributions" className="text-sm font-semibold text-primary hover:text-primary-600">Michango yote →</Link>
            </div>
            {report.statuses.length === 0 ? (
              <div className="p-5"><EmptyState title="Hakuna michango bado" message="Historia yako itaonekana hapa." /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="bg-background text-xs uppercase tracking-wide text-text-secondary">
                    <tr><th className="px-5 py-3 font-semibold">Shughuli</th><th className="px-5 py-3 font-semibold">Hali</th><th className="px-5 py-3 text-right font-semibold">Iliyotarajiwa</th><th className="px-5 py-3 text-right font-semibold">Iliyolipwa</th><th className="px-5 py-3 text-right font-semibold">Salio</th><th className="px-5 py-3 font-semibold">Tarehe ya mwisho</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border-light">
                    {report.statuses.map(row => (
                      <tr key={row.contribution_id} className="hover:bg-background/70">
                        <td className="px-5 py-4 font-semibold text-text">{row.title}</td>
                        <td className="px-5 py-4"><StatusLabel status={row.payment_status} /></td>
                        <td className="px-5 py-4 text-right text-text-secondary">{formatTZS(row.required_amount)}</td>
                        <td className="px-5 py-4 text-right font-semibold text-success">{formatTZS(row.total_paid)}</td>
                        <td className="px-5 py-4 text-right text-text-secondary">{formatTZS(row.remaining_amount)}</td>
                        <td className="px-5 py-4 text-text-secondary">{formatDate(row.due_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
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

function StatusLabel({ status }: { status: MemberContributionStatus['payment_status'] }) {
  const config = status === 'COMPLETED'
    ? ['Imekamilika', 'bg-success-50 text-success']
    : status === 'UNPAID'
      ? ['Haijalipwa', 'bg-error-50 text-error']
      : ['Inaendelea', 'bg-warning-50 text-warning']
  return <span className={`badge ${config[1]}`}>{config[0]}</span>
}
