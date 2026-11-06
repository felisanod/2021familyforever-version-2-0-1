import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

function normalizePhone(input: string) {
  let digits = input.replace(/\D/g, '')
  if (digits.startsWith('255') && digits.length >= 12) digits = `0${digits.slice(3)}`
  else if (!digits.startsWith('0') && digits.length === 9) digits = `0${digits}`
  return digits
}

function maskPhone(phone: string) {
  return `***${phone.slice(-4)}`
}

function requestIp(request: Request) {
  const raw = request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-real-ip')
    ?? request.headers.get('x-forwarded-for')
  return raw?.split(',')[0].trim().slice(0, 64) ?? null
}

async function phoneBucket(phone: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(phone))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  let body: { phone?: unknown; password?: unknown }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid request' }, 400)
  }

  if (typeof body.phone !== 'string' || typeof body.password !== 'string'
    || body.password.length === 0 || body.password.length > 256) {
    return jsonResponse({ error: 'Invalid request' }, 400)
  }

  const phone = normalizePhone(body.phone)
  if (phone.length < 9 || phone.length > 15) return jsonResponse({ error: 'Invalid request' }, 400)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('Login audit function is missing Supabase environment variables')
    return jsonResponse({ error: 'Huduma ya kuingia haipatikani kwa sasa.' }, 503)
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: matchingProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('user_id')
    .eq('phone_number', phone)
    .maybeSingle()
  if (profileError) {
    console.error('Login audit could not look up the attempted account', profileError)
    return jsonResponse({ error: 'Huduma ya kuingia haipatikani kwa sasa.' }, 503)
  }

  const ipAddress = requestIp(request)
  const rateLimitKeys = [`phone:${await phoneBucket(phone)}`]
  if (ipAddress) rateLimitKeys.push(`ip:${ipAddress}`)
  const { data: allowed, error: rateLimitError } = await adminClient.rpc('consume_login_rate_limit', {
    p_keys: rateLimitKeys,
  })
  if (rateLimitError) {
    console.error('Login rate limit could not be checked', rateLimitError)
    return jsonResponse({ error: 'Huduma ya kuingia haipatikani kwa sasa.' }, 503)
  }
  if (!allowed) return jsonResponse({ error: 'Majaribio mengi sana. Jaribu tena baada ya dakika 15.' }, 429)

  const emails = [`${phone}@2021familyforever.online`, `${phone}@2021familyforever.local`]
  let session = null
  for (const email of emails) {
    const result = await authClient.auth.signInWithPassword({ email, password: body.password })
    if (!result.error && result.data.session) {
      session = result.data.session
      break
    }
  }

  const activity = {
    actor_id: session?.user.id ?? matchingProfile?.user_id ?? null,
    activity_type: session ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
    login_identifier: session ? null : maskPhone(phone),
    ip_address: ipAddress,
    user_agent: request.headers.get('user-agent')?.slice(0, 512) ?? null,
  }
  const { error: auditError } = await adminClient.from('application_activity').insert(activity)
  if (auditError) {
    console.error('Login audit event could not be recorded', auditError)
    return jsonResponse({ error: 'Huduma ya kuingia haipatikani kwa sasa.' }, 503)
  }

  if (!session) return jsonResponse({ error: 'Namba ya simu au neno la siri si sahihi.' }, 401)
  return jsonResponse({ session }, 200)
})
