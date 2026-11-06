import { supabase, type Contribution, type MemberContributionStatus, type Profile } from '../types'

export type ContributionWithStats = Contribution & {
  total_members: number
  completed_members: number
  partial_members: number
  pending_members: number
  unpaid_members: number
  total_collected: number
  completion_percent: number
}

/** All contributions with per-contribution payment statistics derived from the DB view. */
export async function listContributions(): Promise<{ contributions: ContributionWithStats[]; error: unknown }> {
  const { data: contributions, error } = await supabase
    .from('contributions')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return { contributions: [], error }

  const { data: statuses, error: viewError } = await supabase
    .from('v_member_contribution_status')
    .select('contribution_id, payment_status, total_paid')

  if (viewError) return { contributions: [], error: viewError }

  const stats = new Map<string, { total: number; completed: number; partial: number; pending: number; unpaid: number; collected: number }>()
  for (const row of (statuses ?? []) as Pick<MemberContributionStatus, 'contribution_id' | 'payment_status' | 'total_paid'>[]) {
    const s = stats.get(row.contribution_id) ?? { total: 0, completed: 0, partial: 0, pending: 0, unpaid: 0, collected: 0 }
    s.total++
    s.collected += Number(row.total_paid ?? 0)
    if (row.payment_status === 'COMPLETED') s.completed++
    else if (row.payment_status === 'PARTIAL') s.partial++
    else if (row.payment_status === 'PENDING') s.pending++
    else s.unpaid++
    stats.set(row.contribution_id, s)
  }

  const result = (contributions as Contribution[]).map(c => {
    const s = stats.get(c.contribution_id) ?? { total: 0, completed: 0, partial: 0, pending: 0, unpaid: 0, collected: 0 }
    return {
      ...c,
      total_members: s.total,
      completed_members: s.completed,
      partial_members: s.partial,
      pending_members: s.pending,
      unpaid_members: s.unpaid,
      total_collected: s.collected,
      completion_percent: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
    }
  })

  return { contributions: result, error: null }
}

export async function getContribution(contributionId: string) {
  const { data, error } = await supabase
    .from('contributions')
    .select('*')
    .eq('contribution_id', contributionId)
    .maybeSingle()
  return { contribution: data as Contribution | null, error }
}

export type ContributionMemberRow = MemberContributionStatus & {
  profile: Pick<Profile, 'full_name' | 'phone_number' | 'region' | 'city' | 'account_status'> | null
  payment_dates: string[]
}

export async function listReportContributions(): Promise<{ contributions: Contribution[]; error: unknown }> {
  const { data, error } = await supabase
    .from('contributions')
    .select('*')
    .order('created_at', { ascending: false })
  return { contributions: (data ?? []) as Contribution[], error }
}

/** Per-member payment summaries for one contribution, joined with profiles. */
export async function getContributionMemberStatuses(contributionId: string): Promise<{ rows: ContributionMemberRow[]; error: unknown }> {
  const statuses: MemberContributionStatus[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('v_member_contribution_status')
      .select('*')
      .eq('contribution_id', contributionId)
      .range(from, from + 999)
    if (error) return { rows: [], error }
    const page = (data ?? []) as unknown as MemberContributionStatus[]
    statuses.push(...page)
    if (page.length < 1000) break
  }

  const memberIds = [...new Set(statuses.map(row => row.member_id))]
  if (memberIds.length === 0) return { rows: [], error: null }

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('user_id, full_name, phone_number, region, city, account_status')
    .in('user_id', memberIds)
  if (profileError) return { rows: [], error: profileError }

  const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]))
  const paymentDates = new Map<string, string[]>()
  for (let from = 0; ; from += 1000) {
    const { data: payments, error: paymentError } = await supabase
      .from('payments')
      .select('member_id, payment_date, created_at')
      .eq('contribution_id', contributionId)
      .eq('payment_status', 'PAID')
      .range(from, from + 999)
    if (paymentError) return { rows: [], error: paymentError }
    for (const payment of payments ?? []) {
      const dates = paymentDates.get(payment.member_id) ?? []
      dates.push(payment.payment_date ?? payment.created_at.slice(0, 10))
      paymentDates.set(payment.member_id, dates)
    }
    if ((payments ?? []).length < 1000) break
  }

  const rows = statuses
    .map(r => ({
      ...r,
      profile: profileMap.get(r.member_id)
        ? {
            full_name: profileMap.get(r.member_id)!.full_name,
            phone_number: profileMap.get(r.member_id)!.phone_number,
            region: profileMap.get(r.member_id)!.region,
            city: profileMap.get(r.member_id)!.city,
            account_status: profileMap.get(r.member_id)!.account_status,
          }
        : null,
      payment_dates: (paymentDates.get(r.member_id) ?? []).sort(),
    }))
    .sort((a, b) => (a.profile?.full_name ?? '').localeCompare(b.profile?.full_name ?? ''))

  return { rows, error: null }
}

export async function createContribution(input: {
  title: string
  description?: string | null
  amount: number
  opening_date: string
  due_date: string
}) {
  const { data: userData } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('contributions')
    .insert({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      amount: input.amount,
      opening_date: input.opening_date,
      due_date: input.due_date,
      status: 'OPEN',
      created_by: userData.user?.id,
    })
    .select()
    .single()
  return { contribution: data as Contribution | null, error }
}

export async function closeContribution(contributionId: string) {
  // Backend function closes the contribution and notifies incomplete members.
  const { error } = await supabase.rpc('close_contribution', { p_contribution_id: contributionId })
  return { error }
}

export async function deleteContribution(contributionId: string) {
  const { error } = await supabase.from('contributions').delete().eq('contribution_id', contributionId)
  return { error }
}