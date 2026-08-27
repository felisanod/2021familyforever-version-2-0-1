/** Full-area loading spinner with optional label. */
export default function Loading({ label = 'Inapakia…', full = false }: { label?: string; full?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-12 ${full ? 'min-h-[50vh]' : ''}`} role="status" aria-live="polite">
      <div className="w-8 h-8 rounded-full border-[3px] border-primary-50 border-t-primary animate-spin" aria-hidden />
      <span className="text-sm text-text-secondary">{label}</span>
    </div>
  )
}