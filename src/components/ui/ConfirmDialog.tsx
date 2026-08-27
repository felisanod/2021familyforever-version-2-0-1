import type { ReactNode } from 'react'

type Props = {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Confirmation dialog for destructive or important operations. */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Thibitisha',
  cancelLabel = 'Ghairi',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-text/30 backdrop-blur-[2px]" onClick={loading ? undefined : onCancel} />
      <div className="relative bg-surface w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl border border-border p-5 sm:p-6">
        <h3 className="text-lg font-semibold text-text">{title}</h3>
        <div className="mt-2 text-sm text-text-secondary leading-relaxed">{message}</div>
        <div className="mt-5 flex gap-3 justify-end">
          <button className="btn btn-ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={loading}>
            {loading ? 'Inafanya kazi…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}