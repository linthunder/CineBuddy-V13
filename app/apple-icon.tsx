import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

/** Ícone para "Adicionar à tela inicial" no iPhone/iPad. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#1a1a1e',
          borderRadius: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#f5c518',
          fontSize: 56,
          fontWeight: 700,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        CB
      </div>
    ),
    { ...size }
  )
}
