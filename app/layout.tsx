import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Bebas_Neue, JetBrains_Mono, Montserrat, Poppins, Oswald, Outfit, Space_Grotesk, Rajdhani, Orbitron } from 'next/font/google'
import './globals.css'

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

/* ── Fontes extras para testar na logo ── */
const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
})

const poppins = Poppins({
  weight: ['400', '600', '700', '800'],
  subsets: ['latin'],
  variable: '--font-poppins',
  display: 'swap',
})

const oswald = Oswald({
  subsets: ['latin'],
  variable: '--font-oswald',
  display: 'swap',
})

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

const rajdhani = Rajdhani({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-rajdhani',
  display: 'swap',
})

const orbitron = Orbitron({
  subsets: ['latin'],
  variable: '--font-orbitron',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'CineBuddy - Orçamento Audiovisual',
  description: 'Sistema de orçamento e gestão de projetos audiovisuais',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={`${plusJakarta.variable} ${bebasNeue.variable} ${jetbrainsMono.variable} ${montserrat.variable} ${poppins.variable} ${oswald.variable} ${outfit.variable} ${spaceGrotesk.variable} ${rajdhani.variable} ${orbitron.variable}`} style={{ backgroundColor: '#0d0d0f' }}>
      <body className="min-h-screen antialiased font-sans" style={{ backgroundColor: '#0d0d0f', color: '#e8e8ec' }}>
        {children}
      </body>
    </html>
  )
}
