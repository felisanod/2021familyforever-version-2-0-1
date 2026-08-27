/**
 * Dynamic payment progress bar.
 * Color reflects payment state and updates automatically:
 *   0%        → gray
 *   1–49%     → red (warning)
 *   50–99%    → amber
 *   ≥100%     → green
 * The bar visually caps at 100% even when overpaid; the actual paid
 * amount is displayed separately by the caller.
 */
export function progressColor(percent: number): { bar: string; text: string } {
  if (percent <= 0) return { bar: 'bg-border', text: 'text-text-secondary' }
  if (percent < 50) return { bar: 'bg-error', text: 'text-error' }
  if (percent < 100) return { bar: 'bg-warning', text: 'text-warning' }
  return { bar: 'bg-success', text: 'text-success' }
}

export default function PaymentProgressBar({
  percent,
  showLabel = true,
  height = 'h-2',
}: {
  percent: number
  showLabel?: boolean
  height?: string
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)))
  const colors = progressColor(clamped)

  return (
    <div>
      <div className={`w-full ${height} bg-border-light rounded-full overflow-hidden`} role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
        <div className={`${height} rounded-full transition-all duration-300 ${colors.bar}`} style={{ width: `${clamped}%` }} />
      </div>
      {showLabel && (
        <p className={`text-xs font-semibold mt-1 ${colors.text}`}>
          {clamped}%
          {percent > 100 && <span className="text-success">+</span>}
        </p>
      )}
    </div>
  )
}