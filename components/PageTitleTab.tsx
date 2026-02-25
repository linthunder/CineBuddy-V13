'use client'

import { resolve } from '@/lib/theme'
import type { ViewId } from '@/components/BottomNav'

const VIEW_TITLES: Record<ViewId, string> = {
  home: 'MURAL',
  filme: 'FILME',
  orcamento: 'ORÇAMENTO PREVISTO',
  'orc-final': 'ORÇAMENTO REALIZADO',
  fechamento: 'FECHAMENTO',
  dashboard: 'DASHBOARD',
  team: 'EQUIPE',
  config: 'CONFIGURAÇÕES',
}

interface PageTitleTabProps {
  currentView: ViewId
}

/** Faixa reduzida em 50% (48px → 24px). */
const STRIP_HEIGHT = 24

/** Sombra suave que header e aba projetam sobre a faixa amarela */
const SOFT_SHADOW = '0 6px 24px rgba(0,0,0,0.3)'

/**
 * Faixa de título em estilo "aba de pasta" — centralizado, amarelo, fundido ao header.
 * Faixa colada ao header. Aba sobrepõe a faixa. Rola com o conteúdo (não fixo).
 */
export default function PageTitleTab({ currentView }: PageTitleTabProps) {
  const title = VIEW_TITLES[currentView] ?? currentView.toUpperCase()
  return (
    <div
      className="flex flex-col mb-6"
      style={{
        marginLeft: 'calc(-1 * var(--page-gutter-content))',
        marginRight: 'calc(-1 * var(--page-gutter-content))',
        width: 'calc(100% + 2 * var(--page-gutter-content))',
      }}
    >
      {/* Faixa amarelo escuro — largura total como o header, rola com o conteúdo */}
      <div
        className="w-full"
        style={{
          height: STRIP_HEIGHT,
          backgroundColor: resolve.yellowDark,
        }}
      />
      {/* Aba central — sobrepõe a faixa (sobe 24px) para projetar sombra nela */}
      <div
        className="flex justify-center w-full"
        style={{ marginTop: -STRIP_HEIGHT }}
      >
        <h1
          className="page-title-tab flex items-center justify-center px-8 py-2.5 rounded-b-xl font-semibold uppercase tracking-widest"
          style={{
            color: resolve.yellow,
            fontSize: '1rem',
            backgroundColor: resolve.panel,
            borderLeft: `1px solid ${resolve.border}`,
            borderRight: `1px solid ${resolve.border}`,
            borderBottom: `1px solid ${resolve.border}`,
            boxShadow: SOFT_SHADOW,
          }}
        >
          {title}
        </h1>
      </div>
    </div>
  )
}
