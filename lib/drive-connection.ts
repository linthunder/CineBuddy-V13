/**
 * Serviço de conexão OAuth do Google Drive.
 * Usado apenas em API routes (servidor). Armazena tokens na tabela drive_connection.
 */

import { createServerClient } from '@/lib/supabase-server'

const CONNECTION_ID = 'default'

export interface DriveConnectionRow {
  id: string
  access_token: string
  refresh_token: string
  expires_at: string
  email: string | null
  root_folder_id: string | null
  created_at: string
  updated_at: string
}

export interface DriveConnectionStatus {
  connected: boolean
  email?: string
  rootFolderId?: string | null
}

/** Retorna a conexão atual (sem expor os tokens). */
export async function getConnectionStatus(): Promise<DriveConnectionStatus> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('drive_connection')
    .select('email, root_folder_id')
    .eq('id', CONNECTION_ID)
    .maybeSingle()

  if (error || !data) {
    return { connected: false }
  }

  const row = data as { email?: string | null; root_folder_id?: string | null }
  return {
    connected: !!row.email,
    email: row.email ?? undefined,
    rootFolderId: row.root_folder_id ?? null,
  }
}

/** Retorna a linha completa da conexão (incluindo tokens). Uso interno. */
export async function getConnectionRow(): Promise<DriveConnectionRow | null> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('drive_connection')
    .select('*')
    .eq('id', CONNECTION_ID)
    .single()

  if (error || !data) return null
  const row = data as DriveConnectionRow
  if (!row.access_token || !row.refresh_token) return null
  return row
}

/** Salva ou atualiza a conexão OAuth. */
export async function saveConnection(params: {
  access_token: string
  refresh_token: string
  expires_at: Date
  email?: string
  root_folder_id?: string | null
}): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('drive_connection')
    .upsert(
      {
        id: CONNECTION_ID,
        access_token: params.access_token,
        refresh_token: params.refresh_token,
        expires_at: params.expires_at.toISOString(),
        email: params.email ?? null,
        root_folder_id: params.root_folder_id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )

  if (error) throw new Error(`Falha ao salvar conexão Drive: ${error.message}`)
}

/** Atualiza apenas root_folder_id. */
export async function updateRootFolderId(rootFolderId: string): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('drive_connection')
    .update({ root_folder_id: rootFolderId, updated_at: new Date().toISOString() })
    .eq('id', CONNECTION_ID)

  if (error) throw new Error(`Falha ao atualizar root_folder_id: ${error.message}`)
}

/** Remove a conexão (desconectar). */
export async function clearConnection(): Promise<void> {
  const supabase = createServerClient()
  await supabase.from('drive_connection').delete().eq('id', CONNECTION_ID)
}
