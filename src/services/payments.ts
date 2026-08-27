import { supabase, type PaymentWithRefs } from '../types'

export type PaymentFilters = {
  search?: string
  contributionId?: string
  memberId?: string
  status?: 'ALL' | 'PAID' | 'PENDING' | 'UNPAID'
  method?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

/** Paginated payment history with member + contribution references (admin). */
export async function listPayments(filters: PaymentFilters = {}) {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 20
  const from = (page - 1) * pageSize

  let query = supabase
    .from('payments')
    .select(
      `*,
       member:profiles!payments_member_id_fkey(full_name, phone_number),
       contribution:contributions(title)`
    )
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)

  if (filters.contributionId) query = query.eq('contribution_id', filters.contributionId)
  if (filters.memberId) query = query.eq('member_id', filters.memberId)
  if (filters.status && filters.status !== 'ALL') query = query.eq('payment_status', filters.status)
  if (filters.method) query = query.eq('payment_method', filters.method)
  if (filters.dateFrom) query = query.gte('payment_date', filters.dateFrom)
  if (filters.dateTo) query = query.lte('payment_date', filters.dateTo)

  let searchIds: string[] | null = null
  if (filters.search) {
    const term = filters.search.trim()
    const { data: matches } = await supabase
      .from('profiles')
      .select('user_id')
      .or(`full_name.ilike.%${term}%,phone_number.ilike.%${term}%`)
    searchIds = (matches ?? []).map(m => m.user_id)
    if (searchIds.length === 0) return { payments: [], total: 0, error: null }
    query = query.in('member_id', searchIds)
  }

  const { data, error, count } = await query
  return { payments: (data ?? []) as unknown as PaymentWithRefs[], total: count ?? 0, error }
}

export type RecordPaymentInput = {
  member_id: string
  contribution_id: string
  amount: number
  payment_date: string
  payment_method: string | null
  transaction_reference: string | null
}

/** Record a payment via backend RPC — validates, updates stats, notifies the member. */
export async function recordPayment(input: RecordPaymentInput) {
  const { data, error } = await supabase.rpc('record_payment', {
    p_member_id: input.member_id,
    p_contribution_id: input.contribution_id,
    p_amount: input.amount,
    p_payment_date: input.payment_date,
    p_payment_method: input.payment_method || null,
    p_transaction_reference: input.transaction_reference || null,
  })
  return { paymentId: data as string | null, error }
}

/** Distinct payment methods used so far (for filter dropdowns). */
export async function listPaymentMethods(): Promise<string[]> {
  const { data } = await supabase.from('payments').select('payment_method').not('payment_method', 'is', null)
  return [...new Set((data ?? []).map(r => r.payment_method).filter(Boolean))] as string[]
}