import type { PaymentStatus, ContributionStatus, AccountStatus, AggregatePaymentStatus } from '../../types'

/** Accessible status badge — always pairs color with a symbol so status is never color-only. */
export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const map = {
    PAID: { cls: 'bg-success-50 text-success border-success/20', mark: '✓', label: 'Imelipwa' },
    PENDING: { cls: 'bg-warning-50 text-warning border-warning/20', mark: '◔', label: 'Inasubiri' },
    UNPAID: { cls: 'bg-error-50 text-error border-error/20', mark: '✕', label: 'Haijalipwa' },
  }[status]
  return (
    <span className={`badge border ${map.cls}`}>
      <span aria-hidden className="mr-1">{map.mark}</span>
      {map.label}
    </span>
  )
}

export function ContributionBadge({ status }: { status: ContributionStatus }) {
  const map = {
    OPEN: { cls: 'bg-success-50 text-success border-success/20', mark: '●', label: 'Wazi' },
    CLOSED: { cls: 'bg-error-50 text-error border-error/20', mark: '■', label: 'Imefungwa' },
  }[status]
  return (
    <span className={`badge border ${map.cls}`}>
      <span aria-hidden className="mr-1">{map.mark}</span>
      {map.label}
    </span>
  )
}

export function AccountBadge({ status }: { status: AccountStatus }) {
  const map = {
    PENDING: { cls: 'bg-warning-50 text-warning border-warning/20', mark: '◔', label: 'Anasubiri Idhini' },
    ACTIVE: { cls: 'bg-success-50 text-success border-success/20', mark: '✓', label: 'Hai' },
    SUSPENDED: { cls: 'bg-warning-50 text-warning border-warning/20', mark: '!', label: 'Amesimamishwa' },
    DELETED: { cls: 'bg-error-50 text-error border-error/20', mark: '✕', label: 'Amefutwa' },
  }[status]
  return (
    <span className={`badge border ${map.cls}`}>
      <span aria-hidden className="mr-1">{map.mark}</span>
      {map.label}
    </span>
  )
}

/** Aggregate member-vs-contribution status badge (Kiswahili). */
export function AggregateBadge({ status }: { status: AggregatePaymentStatus }) {
  const map = {
    PENDING: { cls: 'bg-border-light text-text-secondary border-border', mark: '◔', label: 'Inasubiri' },
    UNPAID: { cls: 'bg-error-50 text-error border-error/20', mark: '✕', label: 'Haijalipwa' },
    PARTIAL: { cls: 'bg-warning-50 text-warning border-warning/20', mark: '◔', label: 'Imekamilika Kiasi' },
    COMPLETED: { cls: 'bg-success-50 text-success border-success/20', mark: '✓', label: 'Imekamilika' },
  }[status]
  return (
    <span className={`badge border ${map.cls}`}>
      <span aria-hidden className="mr-1">{map.mark}</span>
      {map.label}
    </span>
  )
}

export function RoleBadge({ role }: { role: 'MEMBER' | 'ADMIN' }) {
  return (
    <span className={`badge border ${role === 'ADMIN' ? 'bg-secondary-50 text-secondary border-secondary/20' : 'bg-border-light text-text-secondary border-border'}`}>
      {role === 'ADMIN' && <span aria-hidden className="mr-1">★</span>}
      {role === 'ADMIN' ? '' : 'Mwanachama'}
    </span>
  )
}