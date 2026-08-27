import { supabase } from '../types'

/** Upload a profile picture to the member's own folder. Returns public URL. */
export async function uploadProfilePicture(userId: string, file: File): Promise<{ url: string | null; error: unknown }> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${userId}/avatar-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('profile-pictures').upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  })
  if (error) return { url: null, error }
  const { data } = supabase.storage.from('profile-pictures').getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

/** Upload an announcement image (admin). Returns public URL. */
export async function uploadAnnouncementImage(file: File): Promise<{ url: string | null; error: unknown }> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `announcements/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from('announcement-images').upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  })
  if (error) return { url: null, error }
  const { data } = supabase.storage.from('announcement-images').getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}