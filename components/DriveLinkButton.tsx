'use client'

import { useState, useCallback } from 'react'
import { resolve } from '@/lib/theme'

export interface DriveLinkButtonProps {
  projectId: string | null
  drivePath: string
  /** 'folder' = abre pasta; 'contract' | 'invoice' = abre primeiro PDF ou pasta se vazio */
  variant: 'folder' | 'contract' | 'invoice'
  children: React.ReactNode
  title?: string
  className?: string
  disabled?: boolean
  style?: React.CSSProperties
}

export default function DriveLinkButton({
  projectId,
  drivePath,
  variant,
  children,
  title,
  className = '',
  disabled = false,
  style = {},
}: DriveLinkButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleClick = useCallback(async () => {
    if (!projectId?.trim() || !drivePath?.trim() || disabled) return
    setLoading(true)
    try {
      if (variant === 'folder') {
        const params = new URLSearchParams({ projectId, path: drivePath })
        const res = await fetch(`/api/drive/folder-url?${params}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao obter link.')
        window.open(data.url, '_blank')
        return
      }
      // contract | invoice: buscar arquivos, abrir primeiro PDF ou pasta
      const params = new URLSearchParams({ projectId, path: drivePath })
      const res = await fetch(`/api/drive/folder-contents?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao obter pasta.')
      const files = data.files ?? []
      const pdf = files.find((f: { name: string }) => f.name.toLowerCase().endsWith('.pdf'))
      if (pdf?.webViewLink) {
        window.open(pdf.webViewLink, '_blank')
      } else {
        const urlRes = await fetch(`/api/drive/folder-url?${params}`)
        const urlData = await urlRes.json()
        if (urlRes.ok && urlData.url) {
          window.open(urlData.url, '_blank')
        } else {
          throw new Error('Pasta vazia. Faça upload do arquivo.')
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao abrir.'
      if (typeof window !== 'undefined') window.alert(msg)
    } finally {
      setLoading(false)
    }
  }, [projectId, drivePath, variant, disabled])

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading}
      title={title || (variant === 'folder' ? 'Abrir pasta' : variant === 'contract' ? 'Abrir contrato' : 'Abrir nota fiscal')}
      className={className}
      style={{
        borderColor: resolve.border,
        color: resolve.text,
        opacity: disabled ? 0.7 : 1,
        ...style,
      }}
    >
      {loading ? '…' : children}
    </button>
  )
}
