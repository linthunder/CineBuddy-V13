import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (typeof window !== 'undefined' && (!supabaseUrl || !supabaseAnonKey)) {
  console.error(
    '[Supabase] Chave pública não configurada. Adicione no .env.local:\n' +
    '  NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co\n' +
    '  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...\n' +
    'Depois reinicie o servidor (npm run dev).'
  )
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')
