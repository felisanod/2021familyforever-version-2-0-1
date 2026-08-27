import type { ReactNode } from 'react'

type Props = {
  icon?: ReactNode
  title: string
  message?: string
  action?: ReactNode
}

/** Branded empty state used across lists and feeds. */
export default function EmptyState({ icon, title, message, action }: Props) {
  return (
    <div className="empty-state">
      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-primary-50 text-primary flex items-center justify-center">
        {icon ?? (
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-4a2 2 0 00-2 2h-4a2 2 0 00-2-2H4" />
          </svg>
        )}
      </div>
      <p className="font-semibold text-text">{title}</p>
      {message && <p className="text-sm text-text-secondary mt-1 max-w-xs mx-auto">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}