import { supabase, type Contribution, type MemberContributionStatus, type Payment, type Profile } from '../types'

async function fetchAll<T>(table: string, columns: string) {
  const rows: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999)
    if (error) return { rows: [] as T[], error }
    const page = (data ?? []) as T[]
    rows.push(...page)
    if (page.length < 1000) return { rows, error: null }
  }
}

async function fetchMemberPayments(userId: string) {
  const rows: Pick<Payment, 'payment_id' | 'contribution_id' | 'amount' | 'payment_status' | 'payment_date' | 'created_at'>[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('payments')
      .select('payment_id, contribution_id, amount, payment_status, payment_date, created_at')
      .eq('member_id', userId)
      .range(from, from + 999)
    if (error) return { rows: [] as typeof rows, error }
    const page = (data ?? []) as typeof rows
    rows.push(...page)
    if (page.length < 1000) return { rows, error: null }
  }
}

export async function getMemberReport(userId: string) {
  const [statusResult, paymentResult] = await Promise.all([
    supabase
      .from('v_member_contribution_status')
      .select('*')
      .eq('member_id', userId)
      .order('due_date', { ascending: false }),
    fetchMemberPayments(userId),
  ])

  if (statusResult.error) return { statuses: [] as MemberContributionStatus[], payments: [] as Payment[], error: statusResult.error }
  if (paymentResult.error) return { statuses: [] as MemberContributionStatus[], payments: [] as Payment[], error: paymentResult.error }
  return {
    statuses: (statusResult.data ?? []) as unknown as MemberContributionStatus[],
    payments: paymentResult.rows as Payment[],
    error: null,
  }
}

export type AdminContributionReport = {
  contributions: Contribution[]
  statuses: MemberContributionStatus[]
  members: Pick<Profile, 'user_id' | 'full_name' | 'phone_number' | 'region' | 'city'>[]
  payments: Pick<Payment, 'payment_id' | 'member_id' | 'contribution_id' | 'amount' | 'payment_status' | 'payment_date' | 'created_at'>[]
  error: unknown
}

export async function getAdminContributionReport(): Promise<AdminContributionReport> {
  const [contributionResult, statusResult, memberResult, paymentResult] = await Promise.all([
    fetchAll<Contribution>('contributions', '*'),
    fetchAll<MemberContributionStatus>('v_member_contribution_status', '*'),
    fetchAll<Pick<Profile, 'user_id' | 'full_name' | 'phone_number' | 'region' | 'city'>>(
      'profiles',
      'user_id, full_name, phone_number, region, city',
    ),
    fetchAll<AdminContributionReport['payments'][number]>(
      'payments',
      'payment_id, member_id, contribution_id, amount, payment_status, payment_date, created_at',
    ),
  ])

  const error = contributionResult.error ?? statusResult.error ?? memberResult.error ?? paymentResult.error
  return {
    contributions: contributionResult.rows,
    statuses: statusResult.rows,
    members: memberResult.rows,
    payments: paymentResult.rows,
    error,
  }
}

export type ApplicationActivity = {
  activity_id: string
  actor_id: string | null
  activity_type: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'APP_VISIT'
  login_identifier: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export async function listApplicationActivity(filters: {
  activityType?: string
  dateFrom?: string
  dateTo?: string
  userId?: string
  limit?: number
} = {}) {
  let query = supabase
    .from('application_activity')
    .select('activity_id, actor_id, activity_type, login_identifier, ip_address, user_agent, created_at')
    .order('created_at', { ascending: false })
    .limit(filters.limit ?? 250)

  if (filters.activityType) query = query.eq('activity_type', filters.activityType)
  if (filters.dateFrom) query = query.gte('created_at', `${filters.dateFrom}T00:00:00`)
  if (filters.dateTo) query = query.lt('created_at', `${filters.dateTo}T23:59:59.999`)
  if (filters.userId) query = query.eq('actor_id', filters.userId)

  const { data, error } = await query
  return { activities: (data ?? []) as ApplicationActivity[], error }
}

export async function listLastActiveUsers() {
  const { data, error } = await supabase
    .from('v_application_last_active')
    .select('actor_id, last_active_at')
    .order('last_active_at', { ascending: false })
    .limit(250)
  return {
    users: (data ?? []) as { actor_id: string; last_active_at: string }[],
    error,
  }
}

export async function recordApplicationVisit() {
  return supabase.rpc('record_application_visit', {
    p_user_agent: typeof navigator === 'undefined' ? null : navigator.userAgent.slice(0, 512),
  })
}
