'use client'

import { resolve } from '@/lib/theme'

/**
 * Layout mestre das páginas do CineBuddy.
 * Estrutura: título → strip (opcional) → tabs (opcional) → toolbar (opcional) → conteúdo.
 * Replicar esta estrutura em Filme, Orç. Final, Fechamento, Config, etc.
 */
interface PageLayoutProps {
  /** Título da página (ex: "Orçamento", "Dados do projeto"). Omitir para não exibir. */
  title?: string
  /** Conteúdo principal */
  children: React.ReactNode
  /** Faixa superior opcional (ex: FinanceStrip) */
  strip?: React.ReactNode
  /** Abas opcionais (ex: Pré/Prod/Pós) */
  tabs?: React.ReactNode
  /** Área entre tabs e conteúdo (ex: Mini Tables) */
  toolbar?: React.ReactNode
  /** 'grid' = 2 colunas em lg (como Orçamento); 'single' = uma coluna */
  contentLayout?: 'single' | 'grid'
}

export default function PageLayout({
  title,
  children,
  strip,
  tabs,
  toolbar,
  contentLayout = 'single',
}: PageLayoutProps) {
  return (
    <div className="page-layout min-w-0">
      {title && (
        <h1
          className="page-layout__title"
          style={{ color: resolve.muted }}
        >
          {title}
        </h1>
      )}

      {strip && (
        <div className="page-layout__strip min-w-0">
          {strip}
        </div>
      )}

      {tabs && (
        <div className="page-layout__tabs min-w-0">
          {tabs}
        </div>
      )}

      {toolbar && (
        <div className="page-layout__toolbar min-w-0">
          {toolbar}
        </div>
      )}

      <div
        className={
          contentLayout === 'grid'
            ? 'page-layout__content page-layout__content--grid'
            : 'page-layout__content'
        }
      >
        {children}
      </div>
    </div>
  )
}
