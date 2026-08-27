import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { supabase, type Profile } from '../types'

interface RegisterDetails {
  fullName: string
  phone: string
  region: string
  city: string
  password: string
}

interface AuthContextType {
  user: Profile | null
  loading: boolean
  login: (phone: string, password: string) => Promise<{ error?: string }>
  register: (details: RegisterDetails) => Promise<{ error?: string }>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

/**
 * Normalize any phone format to the local login convention: 0XXXXXXXXX
 * Accepts: 0712345678 · +255712345678 · 255712345678 · 712345678
 */
export function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, '')
  if (digits.startsWith('255') && digits.length >= 12) digits = '0' + digits.slice(3)
  else if (!digits.startsWith('0') && digits.length === 9) digits = '0' + digits
  return digits
}

/** Current email convention — a real TLD is required by Supabase signup validation. */
export function phoneToEmail(phone: string): string {
  return `${normalizePhone(phone)}@2021familyforever.online`
}

/** Legacy convention used by pre-existing seeded accounts. */
export function legacyPhoneToEmail(phone: string): string {
  return `${normalizePhone(phone)}@2021familyforever.local`
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const loginInProgressRef = useRef(false)

  const applyProfile = useCallback(async (userId: string): Promise<{ error?: string }> => {
    // Retry transient failures (e.g. brief offline moments) so an existing
    // login session is never dropped because of a single network hiccup.
    let profile: Profile | null = null
    let lastError: unknown = null
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
      if (!error) {
        profile = data as Profile | null
        break
      }
      lastError = error
      await new Promise(resolve => setTimeout(resolve, 800 * (attempt + 1)))
    }

    if (!profile && lastError) {
      setUser(null)
      return { error: 'Kuna kitu hakifanyi kazi. Tafadhali jaribu tena.' }
    }

    if (!profile) {
      // Authenticated but no profile — sign out to avoid a broken session.
      await supabase.auth.signOut()
      setUser(null)
      return { error: 'Akaunti haipatikani. Akaunti hii haipo tena.' }
    }

    const p = profile
    if (p.account_status === 'PENDING') {
      // Self-registered accounts must be approved by an admin first.
      await supabase.auth.signOut()
      setUser(null)
      return { error: 'Akaunti yako bado haijaidhinishwa na . Tafadhali subiri uidhinishwe kwanza.' }
    }
    if (p.account_status === 'SUSPENDED') {
      await supabase.auth.signOut()
      setUser(null)
      return { error: 'Akaunti Imesimamishwa. Akaunti yako imesimamishwa kwa sasa. Tafadhali wasiliana na .' }
    }
    if (p.account_status === 'DELETED') {
      await supabase.auth.signOut()
      setUser(null)
      return { error: 'Akaunti Haipatikani. Akaunti hii haipo tena.' }
    }

    setUser(p)
    return {}
  }, [])

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (session?.user) {
          void applyProfile(session.user.id).finally(() => setLoading(false))
        } else {
          setUser(null)
          setLoading(false)
        }
      })
      .catch(() => setLoading(false))

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        if (!loginInProgressRef.current) {
          void applyProfile(session.user.id)
        }
        loginInProgressRef.current = false
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [applyProfile])

  const login = async (phone: string, password: string) => {
    try {
      loginInProgressRef.current = true

      // New accounts use the current domain; older seeded accounts still use
      // the legacy one — try both before giving up.
      let { data, error } = await supabase.auth.signInWithPassword({
        email: phoneToEmail(phone),
        password,
      })
      if ((error || !data.user)) {
        const retry = await supabase.auth.signInWithPassword({
          email: legacyPhoneToEmail(phone),
          password,
        })
        data = retry.data
        error = retry.error
      }

      if (error || !data.user) {
        loginInProgressRef.current = false
        return { error: 'Namba ya simu au neno la siri si sahihi. Tafadhali jaribu tena.' }
      }

      const result = await applyProfile(data.user.id)
      loginInProgressRef.current = false
      return result
    } catch {
      loginInProgressRef.current = false
      return { error: 'Haupo mtandaoni. Tafadhali angalia muunganisho wako kisha ujaribu tena.' }
    }
  }

  /**
   * Self-registration: creates the auth user; the DB trigger (handle_new_user)
   * inserts the profile with account_status = 'PENDING'. The session is
   * discarded immediately — the applicant cannot enter until an admin approves.
   */
  const register = async (details: RegisterDetails) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: phoneToEmail(details.phone),
        password: details.password,
        options: {
          data: {
            full_name: details.fullName.trim(),
            phone_number: normalizePhone(details.phone),
            region: details.region.trim(),
            city: details.city.trim(),
            role: 'MEMBER',
          },
        },
      })

      if (error) {
        const lower = error.message.toLowerCase()
        if (lower.includes('already registered') || lower.includes('already exists') || lower.includes('duplicate')) {
          return { error: 'Namba hii ya simu imeshasajiliwa. Tafadhali ingia au tumia namba nyingine.' }
        }
        if (lower.includes('password') && lower.includes('least')) {
          return { error: 'Neno la siri lifupi. Tumia herufi angalau 6.' }
        }
        if (lower.includes('signup')) {
          return { error: 'Usajili wa akaunti mpya umefungwa kwa sasa.' }
        }
        return { error: 'Usajili umeshindikana. Tafadhali jaribu tena.' }
      }
      if (!data.user) {
        return { error: 'Kuna kitu hakifanyi kazi. Tafadhali jaribu tena.' }
      }

      // Discard the auto-created session — entry is denied until approval.
      await supabase.auth.signOut()
      setUser(null)
      return {}
    } catch {
      return { error: 'Haupo mtandaoni. Tafadhali angalia muunganisho wako kisha ujaribu tena.' }
    }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  const refreshUser = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) await applyProfile(session.user.id)
  }, [applyProfile])

  return <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}