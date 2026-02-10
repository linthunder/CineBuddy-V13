import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

/** Cliente Supabase com service role — usar apenas em API routes (servidor). Nunca exponha no client. */
export function createServerClient() {
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não definida. Adicione em .env.local para usar APIs de usuário.')
  }
  return createClient(url, serviceRoleKey)
}
