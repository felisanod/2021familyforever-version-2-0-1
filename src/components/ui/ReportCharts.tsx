import { formatTZS } from '../../utils/format'

export type ChartPoint = { label: string; value: number }
export type ChartSlice = { label: string; value: number; color: string }

export function MemberBarChart({
  points,
  format = 'currency',
}: {
  points: ChartPoint[]
  format?: 'currency' | 'percent'
}) {
  if (points.length === 0) {
    return <p className="py-12 text-center text-sm text-text-secondary">Hakuna data ya wanachama bado.</p>
  }

  const max = Math.max(...points.map(point => point.value), 1)

  return (
    <div className="max-h-96 space-y-3 overflow-y-auto">
      {points.map((point, index) => {
        const valueLabel = format === 'currency' ? formatTZS(point.value) : `${Math.round(point.value)}%`
        const percent = max > 0 ? Math.max(0, (point.value / max) * 100) : 0
        return (
          <div
            key={`${point.label}-${index}`}
            className="grid grid-cols-[minmax(5.5rem,1fr)_minmax(3rem,2fr)_auto] items-center gap-2"
            title={`${point.label}: ${valueLabel}`}
          >
            <span className="truncate text-xs text-text-secondary" title={point.label}>{point.label}</span>
            <div
              className="progress-track h-3 overflow-hidden rounded-full"
              role="progressbar"
              aria-label={point.label}
              aria-valuenow={Math.round(percent)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${percent}%` }} />
            </div>
            <span className="max-w-24 truncate text-right text-[11px] font-medium text-text">{valueLabel}</span>
          </div>
        )
      })}
    </div>
  )
}

export function CollectionProgressChart({
  collected,
  expected,
  outstanding,
}: {
  collected: number
  expected: number
  outstanding: number
}) {
  const percent = expected > 0 ? Math.min(100, (collected / expected) * 100) : 0
  return (
    <div role="img" aria-label={`Makusanyo yamefikia ${Math.round(percent)}% ya lengo`}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <strong className="text-3xl font-bold text-primary">{Math.round(percent)}%</strong>
        <span className="text-right text-xs text-text-secondary">{formatTZS(collected)} kati ya {formatTZS(expected)}</span>
      </div>
      <div className="h-5 overflow-hidden rounded-full bg-background" aria-hidden="true">
        <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-3 flex justify-between gap-3 text-xs text-text-secondary">
        <span>Imekusanywa: {formatTZS(collected)}</span>
        <span>Salio: {formatTZS(outstanding)}</span>
      </div>
    </div>
  )
}

export function ActivityChart({ points, currency = true }: { points: ChartPoint[]; currency?: boolean }) {
  const width = 640
  const height = 220
  const inset = { top: 16, right: 12, bottom: 36, left: 18 }
  const chartWidth = width - inset.left - inset.right
  const chartHeight = height - inset.top - inset.bottom
  const max = Math.max(...points.map(point => point.value), 1)
  const coordinates = points.map((point, index) => ({
    ...point,
    x: inset.left + (points.length <= 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth),
    y: inset.top + chartHeight - (point.value / max) * chartHeight,
  }))
  const line = coordinates.map(point => `${point.x},${point.y}`).join(' ')
  const area = coordinates.length
    ? `${inset.left},${inset.top + chartHeight} ${line} ${inset.left + chartWidth},${inset.top + chartHeight}`
    : ''

  if (points.length === 0) {
    return <p className="py-12 text-center text-sm text-text-secondary">Hakuna data ya mwenendo bado.</p>
  }

  return (
    <div className="w-full overflow-hidden">
      <svg className="w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Mchoro wa shughuli za michango">
        <defs>
          <linearGradient id="activity-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity=".2" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map(fraction => {
          const y = inset.top + chartHeight * fraction
          return <line key={fraction} x1={inset.left} x2={width - inset.right} y1={y} y2={y} stroke="var(--color-border-light)" strokeDasharray="4 5" />
        })}
        <polygon points={area} fill="url(#activity-fill)" />
        <polyline points={line} fill="none" stroke="var(--color-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {coordinates.map((point, index) => (
          <g key={`${point.label}-${index}`}>
            <circle cx={point.x} cy={point.y} r="5" fill="var(--color-surface)" stroke="var(--color-primary)" strokeWidth="3">
              <title>{point.label}: {currency ? formatTZS(point.value) : point.value}</title>
            </circle>
            <text x={point.x} y={height - 10} textAnchor="middle" fill="var(--color-text-secondary)" fontSize="11">{point.label}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

export function DistributionChart({
  slices,
  formatValue = value => String(value),
}: {
  slices: ChartSlice[]
  formatValue?: (value: number) => string
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  const radius = 48
  const circumference = 2 * Math.PI * radius
  const segments = slices.map((slice, index) => ({
    slice,
    length: total > 0 ? (slice.value / total) * circumference : 0,
    offset: slices.slice(0, index).reduce(
      (sum, previous) => sum + (total > 0 ? (previous.value / total) * circumference : 0),
      0,
    ),
  }))

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center sm:gap-8">
      <div className="relative h-36 w-36 shrink-0" role="img" aria-label="Mgawanyo wa hali za michango">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--color-border-light)" strokeWidth="16" />
          {segments.map(({ slice, length, offset }) => {
            return length > 0 ? (
              <circle
                key={slice.label}
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth="16"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
              >
                <title>{slice.label}: {formatValue(slice.value)} ({Math.round((slice.value / total) * 100)}%)</title>
              </circle>
            ) : null
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <strong className="text-2xl text-text">{total}</strong>
          <span className="text-xs text-text-secondary">Michango</span>
        </div>
      </div>
      <ul className="w-full space-y-3 sm:w-auto">
        {slices.map(slice => (
          <li key={slice.label} className="flex items-center justify-between gap-6 text-sm sm:justify-start">
            <span className="flex items-center gap-2 text-text-secondary">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
              {slice.label}
            </span>
            <strong className="text-text">{formatValue(slice.value)}{total > 0 && <span className="ml-1 text-xs font-normal text-text-secondary">({Math.round((slice.value / total) * 100)}%)</span>}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}
