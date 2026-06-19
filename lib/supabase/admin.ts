import { createClient } from '@supabase/supabase-js'

// Client com service_role — usar APENAS em Server Actions/API routes, nunca no client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export { supabaseAdmin }
