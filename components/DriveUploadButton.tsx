'use client'

import { useRef, useState, useCallback } from 'react'
import { Upload, FolderOpen } from 'lucide-react'
import { resolve } from '@/lib/theme'

export interface DriveUploadButtonProps {
  projectId: string | null
  drivePath: string
  onUploadComplete?: (fileUrl: string) => void
  onError?: (message: string) => void
  disabled?: boolean
  /** Se true, mostra botão "ENVIAR" ao lado do seletor de arquivo */
  showSendButton?: boolean
  className?: string
  /** Estilo compacto (apenas ícone no botão de upload) */
  compact?: boolean
}

const iconBtnCls = 'team-info-btn w-7 h-7 flex items-center justify-center rounded border transition-colors text-xs font-medium'

export default function DriveUploadButton({
  projectId,
  drivePath,
  onUploadComplete,
  onError,
  disabled = false,
  showSendButton = true,
  className = '',
  compact = false,
}: DriveUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [justUploaded, setJustUploaded] = useState(false)

  const openFolder = useCallback(async () => {
    if (!projectId?.trim() || !drivePath?.trim()) return
    try {
      const params = new URLSearchParams({ projectId, path: drivePath })
      const res = await fetch(`/api/drive/folder-url?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao obter link.')
      window.open(data.url, '_blank')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao abrir pasta.'
      onError?.(msg)
      if (typeof window !== 'undefined' && !onError) window.alert(msg)
    }
  }, [projectId, drivePath, onError])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setSelectedFile(file ?? null)
    setJustUploaded(false)
    if (file && !showSendButton) {
      void doUpload(file)
    }
    e.target.value = ''
  }

  const doUpload = async (file: File) => {
    if (!projectId?.trim() || !drivePath?.trim()) {
      const msg = 'Projeto ou pasta não definidos.'
      onError?.(msg)
      if (typeof window !== 'undefined' && !onError) window.alert(msg)
      return
    }
    setUploading(true)
    setJustUploaded(false)
    try {
      const formData = new FormData()
      formData.set('projectId', projectId)
      formData.set('path', drivePath)
      formData.set('file', file)
      const res = await fetch('/api/drive/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao enviar arquivo.')
      }
      onUploadComplete?.(data.fileUrl)
      setSelectedFile(null)
      setJustUploaded(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar.'
      onError?.(msg)
      if (typeof window !== 'undefined' && !onError) window.alert(msg)
    } finally {
      setUploading(false)
    }
  }

  const handleSend = () => {
    if (selectedFile) void doUpload(selectedFile)
  }

  const handleClick = () => {
    if (uploading || disabled) return
    if (!projectId?.trim()) {
      const msg = 'Projeto não possui pasta no Drive. Salve o projeto primeiro.'
      onError?.(msg)
      if (typeof window !== 'undefined' && !onError) window.alert(msg)
      return
    }
    inputRef.current?.click()
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || uploading}
        title="Upload de nota fiscal"
        className={iconBtnCls}
        style={{
          borderColor: resolve.border,
          color: resolve.text,
          opacity: disabled ? 0.5 : 1,
          width: compact ? 28 : 28,
          height: compact ? 28 : 28,
          minWidth: 28,
          minHeight: 28,
        }}
      >
        <Upload size={compact ? 14 : 14} strokeWidth={2} style={{ color: 'currentColor' }} />
      </button>
      {showSendButton && (selectedFile || justUploaded) && (
        <button
          type="button"
          onClick={justUploaded ? openFolder : handleSend}
          disabled={uploading}
          className="btn-resolve-hover text-[10px] font-medium uppercase px-1.5 py-0.5 rounded border flex items-center gap-1"
          style={{
            backgroundColor: resolve.bg,
            borderColor: resolve.border,
            color: resolve.accent,
            height: 22,
          }}
        >
          {justUploaded ? (
            <>
              <FolderOpen size={12} strokeWidth={2} />
              ABRIR PASTA
            </>
          ) : uploading ? (
            '…'
          ) : (
            'ENVIAR'
          )}
        </button>
      )}
    </div>
  )
}
