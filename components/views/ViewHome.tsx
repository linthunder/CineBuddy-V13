'use client'

import PageLayout from '@/components/PageLayout'
import { resolve } from '@/lib/theme'

export default function ViewHome() {
  return (
    <PageLayout title="Home" contentLayout="single">
      <div
        className="rounded border flex flex-col items-center justify-center gap-4 py-16 px-6 text-center"
        style={{ borderColor: resolve.border, backgroundColor: resolve.panel }}
      >
        <p className="text-base sm:text-lg font-medium" style={{ color: resolve.text }}>
          Em desenvolvimento
        </p>
        <p className="text-sm max-w-md" style={{ color: resolve.muted }}>
          Esta página está em construção. Em breve você terá acesso às funcionalidades da Home.
        </p>
      </div>
    </PageLayout>
  )
}
