import { supabase, type Profile } from '../types'

export type MemberFilters = {
  search?: string
  status?: 'ALL' | Profile['account_status']
  role?: 'ALL' | Profile['role']
  region?: string
  page?: number
  pageSize?: number
}

/** Paginated, searchable member list (admin). */
export async function listMembers(filters: MemberFilters = {}) {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 20
  const from = (page - 1) * pageSize

  let query = supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)

  if (filters.search) {
    const term = filters.search.trim()
    query = query.or(
      `full_name.ilike.%${term}%,phone_number.ilike.%${term}%,region.ilike.%${term}%,city.ilike.%${term}%`
    )
  }
  if (filters.status && filters.status !== 'ALL') query = query.eq('account_status', filters.status)
  if (filters.role && filters.role !== 'ALL') query = query.eq('role', filters.role)
  if (filters.region) query = query.ilike('region', `%${filters.region}%`)

  const { data, error, count } = await query
  return { members: (data ?? []) as Profile[], total: count ?? 0, error }
}

/** Read-only family directory for members: active members, basic info only. */
export async function listMemberDirectory(search?: string): Promise<{ members: Profile[]; error: unknown }> {
  let query = supabase
    .from('profiles')
    .select('user_id, full_name, region, city, profile_picture, role')
    .eq('account_status', 'ACTIVE')
    .order('full_name')

  if (search?.trim()) {
    const term = search.trim()
    query = query.or(`full_name.ilike.%${term}%,region.ilike.%${term}%,city.ilike.%${term}%`)
  }

  const { data, error } = await query
  return { members: (data ?? []) as Profile[], error }
}

export async function getMember(memberId: string) {
  const { data, error } = await supabase.from('profiles').select('*').eq('user_id', memberId).maybeSingle()
  return { member: data as Profile | null, error }
}

export async function listRegions(): Promise<string[]> {
  const { data } = await supabase.from('profiles').select('region').neq('region', '').order('region')
  const regions = [...new Set((data ?? []).map(r => r.region.trim()))].filter(Boolean)
  regions.sort((a, b) => a.localeCompare(b))
  return regions
}

export async function updateOwnProfile(
  userId: string,
  updates: Pick<Profile, 'full_name' | 'region' | 'city' | 'profile_picture'>
) {
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: updates.full_name,
      region: updates.region,
      city: updates.city,
      profile_picture: updates.profile_picture,
    })
    .eq('user_id', userId)
  return { error }
}

async function requireAdmin() {
  const { data: me } = await supabase.from('profiles').select('role').eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '').maybeSingle()
  return me?.role === 'ADMIN'
}

export async function setMemberRole(memberId: string, role: Profile['role']) {
  if (!(await requireAdmin())) return { error: new Error('Only administrators can change roles') }
  const { error } = await supabase.from('profiles').update({ role }).eq('user_id', memberId)
  return { error }
}

export async function setMemberStatus(memberId: string, status: Profile['account_status']) {
  if (!(await requireAdmin())) return { error: new Error('Only administrators can manage accounts') }
  // Backend function updates the profile and generates the account notification.
  const { error } = await supabase.rpc('admin_set_member_status', { p_member_id: memberId, p_status: status })
  return { error }
}
