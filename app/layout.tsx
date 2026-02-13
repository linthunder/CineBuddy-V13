import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans, Bebas_Neue, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const viewport: Viewport = {
  themeColor: '#1a1a1e',
}

export const metadata: Metadata = {
  title: 'CineBuddy - Orçamento Audiovisual',
  description: 'Sistema de orçamento e gestão de projetos audiovisuais',
  appleWebApp: {
    capable: true,
    title: 'CineBuddy',
    statusBarStyle: 'black-translucent',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={`${plusJakarta.variable} ${bebasNeue.variable} ${jetbrainsMono.variable}`} style={{ backgroundColor: '#0d0d0f' }}>
      <body className="min-h-screen antialiased font-sans" style={{ backgroundColor: '#0d0d0f', color: '#e8e8ec' }}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
