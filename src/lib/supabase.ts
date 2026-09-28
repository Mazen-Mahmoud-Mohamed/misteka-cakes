import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

function looksLikeServiceRole(key: string): boolean {
  try {
    const payload = key.split('.')[1]
    if (!payload) return false
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { role?: string }
    return json.role === 'service_role'
  } catch {
    return false
  }
}

export function isSupabaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}

export function getSupabase(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return null
  if (looksLikeServiceRole(key)) {
    console.error('Refusing to start Supabase with a service-role key in the browser.')
    return null
  }
  if (!client) client = createClient(url, key)
  return client
}
