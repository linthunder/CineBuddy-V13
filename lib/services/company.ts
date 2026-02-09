import { supabase } from '@/lib/supabase'

export interface CompanyData {
  id: string
  razao_social: string
  nome_fantasia: string
  cnpj: string
  telefone: string
  email: string
  site: string
  endereco: string
  logo_url: string
  created_at: string
  updated_at: string
}

export type CompanyInsert = Omit<CompanyData, 'id' | 'created_at' | 'updated_at'>

/**
 * Carrega os dados da produtora.
 * Como só existe uma linha, retorna o primeiro (e único) registro.
 */
export async function getCompany(): Promise<CompanyData | null> {
  const { data, error } = await supabase
    .from('company')
    .select('*')
    .limit(1)
    .single()

  if (error) {
    console.error('Erro ao carregar dados da produtora:', error)
    return null
  }
  return data
}

/**
 * Salva os dados da produtora.
 * Se já existe um registro, atualiza. Se não existe, cria.
 */
export async function saveCompany(companyData: Partial<CompanyInsert>): Promise<CompanyData | null> {
  const existing = await getCompany()

  if (existing) {
    const { data, error } = await supabase
      .from('company')
      .update(companyData)
      .eq('id', existing.id)
      .select()
      .single()

    if (error) {
      console.error('Erro ao salvar dados da produtora:', error)
      return null
    }
    return data
  } else {
    const { data, error } = await supabase
      .from('company')
      .insert(companyData)
      .select()
      .single()

    if (error) {
      console.error('Erro ao criar dados da produtora:', error)
      return null
    }
    return data
  }
}

/**
 * Faz upload da logo da empresa no Supabase Storage e salva a URL no banco.
 * Retorna a URL pública da logo ou null em caso de erro.
 */
export async function uploadCompanyLogo(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'png'
  const path = `company-logo.${ext}`

  // Upload (upsert para substituir se já existir)
  const { error: uploadError } = await supabase.storage
    .from('logos')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) {
    console.error('Erro ao fazer upload da logo:', uploadError)
    return null
  }

  // Obter URL pública
  const { data: urlData } = supabase.storage
    .from('logos')
    .getPublicUrl(path)

  const publicUrl = urlData.publicUrl
  if (!publicUrl) return null

  // Salvar a URL no banco (com timestamp para cache-busting)
  const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`
  await saveCompany({ logo_url: urlWithCacheBust })

  return urlWithCacheBust
}
