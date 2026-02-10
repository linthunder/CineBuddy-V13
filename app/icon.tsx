import { ImageResponse } from 'next/og'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

/** Ícone do app (favicon, PWA, "Adicionar à tela inicial"). */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#1a1a1e',
          borderRadius: '16%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#f5c518',
          fontSize: 160,
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
