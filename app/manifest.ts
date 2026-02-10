import type { MetadataRoute } from 'next'

/** Manifest PWA: permite "Adicionar à tela inicial" / "Instalar app" no celular. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CineBuddy - Orçamento Audiovisual',
    short_name: 'CineBuddy',
    description: 'Sistema de orçamento e gestão de projetos audiovisuais',
    start_url: '/',
    display: 'standalone',
    background_color: '#0d0d0f',
    theme_color: '#1a1a1e',
    orientation: 'portrait-primary',
    icons: [
      { src: '/icon', type: 'image/png', sizes: '192x192', purpose: 'any' },
      { src: '/icon', type: 'image/png', sizes: '512x512', purpose: 'maskable' },
    ],
  }
}
