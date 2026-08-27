import { createClient } from '@supabase/supabase-js'
import { supabaseUrl, supabaseAnonKey } from '../services/supabase'

/**
 * Persistent login sessions:
 * - persistSession: the session survives app restarts (stored in localStorage)
 * - autoRefreshToken: access tokens renew automatically while the app is open
 * - detectSessionInUrl: disabled — login is phone/password only
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: '2021familyforever-auth',
    flowType: 'pkce',
  },
})

export type Role = 'MEMBER' | 'ADMIN'
export type AccountStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DELETED'
export type ContributionStatus = 'OPEN' | 'CLOSED'
/** Status of an individual payment transaction row. */
export type PaymentStatus = 'PAID' | 'PENDING' | 'UNPAID'
/** Aggregate member-vs-contribution status, derived from total paid vs required. */
export type AggregatePaymentStatus = 'PENDING' | 'UNPAID' | 'PARTIAL' | 'COMPLETED'
export type AnnouncementStatus = 'DRAFT' | 'PUBLISHED' | 'EXPIRED'
export type AudienceType = 'ALL' | 'SELECTED' | 'REGION'
export type NotificationType = 'ANNOUNCEMENT' | 'CONTRIBUTION' | 'PAYMENT' | 'ACCOUNT' | 'SYSTEM'

export type Profile = {
  user_id: string
  phone_number: string
  full_name: string
  region: string
  city: string
  profile_picture: string | null
  role: Role
  account_status: AccountStatus
  created_at: string
  updated_at: string
}

export type Contribution = {
  contribution_id: string
  title: string
  description: string | null
  amount: number
  opening_date: string
  due_date: string
  status: ContributionStatus
  created_by: string
  created_at: string
  updated_at: string
}

/** Authoritative per-member contribution/payment summary (DB view).
 *  All money fields are derived from actual payment totals in the database. */
export type MemberContributionStatus = {
  contribution_id: string
  title: string
  description: string | null
  required_amount: number
  opening_date: string
  due_date: string
  contribution_status: ContributionStatus
  member_id: string
  total_paid: number
  remaining_amount: number
  overpaid_amount: number
  progress_percent: number
  payment_status: AggregatePaymentStatus
  last_payment_date: string | null
  payment_count: number
}

export type Payment = {
  payment_id: string
  member_id: string
  contribution_id: string
  amount: number
  payment_status: PaymentStatus
  payment_date: string | null
  payment_method: string | null
  transaction_reference: string | null
  recorded_by: string | null
  created_at: string
  updated_at: string
}

export type Announcement = {
  announcement_id: string
  title: string
  message: string
  image_url: string | null
  attachment_url: string | null
  created_by: string
  audience_type: AudienceType
  audience_region: string | null
  audience_city: string | null
  published_at: string | null
  expires_at: string | null
  status: AnnouncementStatus
  created_at: string
  updated_at: string
}

export type Notification = {
  notification_id: string
  member_id: string
  type: NotificationType
  title: string
  message: string
  related_id: string | null
  is_read: boolean
  created_at: string
}

export type DeviceToken = {
  device_token_id: string
  user_id: string
  push_token: string
  platform: string
  is_active: boolean
  created_at: string
  updated_at: string
}

/** Joined shape used by admin payment history tables. */
export type PaymentWithRefs = Payment & {
  member?: Pick<Profile, 'full_name' | 'phone_number'> | null
  contribution?: Pick<Contribution, 'title'> | null
}