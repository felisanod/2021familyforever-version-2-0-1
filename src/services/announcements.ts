import { supabase, type Announcement, type Profile } from '../types'

export type PublishAnnouncementInput = {
  title: string
  message: string
  image_url?: string | null
  attachment_url?: string | null
  audience_type: 'ALL' | 'SELECTED' | 'REGION'
  audience_region?: string | null
  audience_city?: string | null
  expires_at?: string | null
  selected_members?: string[]
}

/** Publish via backend RPC — saves announcement, resolves recipients, fans out notifications. */
export async function publishAnnouncement(input: PublishAnnouncementInput) {
  const { data, error } = await supabase.rpc('publish_announcement', {
    p_title: input.title,
    p_message: input.message,
    p_image_url: input.image_url || null,
    p_attachment_url: input.attachment_url || null,
    p_audience_type: input.audience_type,
    p_audience_region: input.audience_region || null,
    p_audience_city: input.audience_city || null,
    p_expires_at: input.expires_at || null,
    p_selected_members: input.audience_type === 'SELECTED' ? (input.selected_members ?? []) : null,
  })
  const result = (data ?? null) as { announcement_id: string; recipients: number } | null
  return { result, error }
}

/** Save a draft (admin). Recipients for SELECTED audiences are stored immediately. */
export async function saveDraftAnnouncement(input: PublishAnnouncementInput) {
  const { data: userData } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('announcements')
    .insert({
      title: input.title.trim(),
      message: input.message.trim(),
      image_url: input.image_url || null,
      attachment_url: input.attachment_url || null,
      created_by: userData.user?.id,
      audience_type: input.audience_type,
      audience_region: input.audience_region || null,
      audience_city: input.audience_city || null,
      expires_at: input.expires_at || null,
      status: 'DRAFT',
    })
    .select()
    .single()

  if (error || !data) return { announcement: null, error }

  const draft = data as Announcement

  if (input.audience_type === 'SELECTED' && input.selected_members?.length) {
    const { error: recError } = await supabase
      .from('announcement_recipients')
      .insert(input.selected_members.map(memberId => ({ announcement_id: draft.announcement_id, member_id: memberId })))
    if (recError) return { announcement: draft, error: recError }
  }

  return { announcement: draft, error: null }
}

/** Publish a previously saved draft via backend RPC. */
export async function publishDraftAnnouncement(announcementId: string) {
  const { data, error } = await supabase.rpc('publish_draft_announcement', { p_announcement_id: announcementId })
  return { recipients: (data as number | null) ?? 0, error }
}

export async function deleteAnnouncement(announcementId: string) {
  const { error } = await supabase.from('announcements').delete().eq('announcement_id', announcementId)
  return { error }
}

export async function listAnnouncements(status?: Announcement['status']) {
  let query = supabase.from('announcements').select('*').order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  return { announcements: (data ?? []) as Announcement[], error }
}

/** Member-facing feed: published announcements visible to this member. */
export async function listVisibleAnnouncements() {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('status', 'PUBLISHED')
    .order('published_at', { ascending: false })
  return { announcements: (data ?? []) as Announcement[], error }
}

export async function getAnnouncement(announcementId: string) {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('announcement_id', announcementId)
    .maybeSingle()
  return { announcement: data as Announcement | null, error }
}

/** Read statistics for one announcement (admin). */
export async function getAnnouncementStats(announcementId: string) {
  const { count: recipients } = await supabase
    .from('announcement_recipients')
    .select('*', { count: 'exact', head: true })
    .eq('announcement_id', announcementId)

  const { count: read } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('related_id', announcementId)
    .eq('type', 'ANNOUNCEMENT')
    .eq('is_read', true)

  const total = recipients ?? 0
  const readCount = read ?? 0
  return {
    recipients: total,
    read: readCount,
    unread: Math.max(total - readCount, 0),
    percent: total > 0 ? Math.round((readCount / total) * 1000) / 10 : 0,
  }
}

/** Author name lookup for announcement cards. */
export async function getAuthorName(userId: string): Promise<string> {
  const { data } = await supabase.from('profiles').select('full_name').eq('user_id', userId).maybeSingle()
  return (data as Pick<Profile, 'full_name'> | null)?.full_name ?? 'Administrator'
}

/** Count of active members — used for the publish confirmation summary. */
export async function countActiveMembers(): Promise<number> {
  const { count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('account_status', 'ACTIVE')
  return count ?? 0
}