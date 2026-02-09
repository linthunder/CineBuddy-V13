'use client'

import PageLayout from '@/components/PageLayout'
import { resolve } from '@/lib/theme'

interface ViewPlaceholderProps {
  title: string
  description?: string
}

export default function ViewPlaceholder({ title, description = 'Em breve.' }: ViewPlaceholderProps) {
  return (
    <PageLayout title={title} contentLayout="single">
      <div
        className="rounded border p-8 text-center"
        style={{ borderColor: resolve.border, backgroundColor: resolve.panel }}
      >
        <p style={{ color: resolve.muted }}>{description}</p>
      </div>
    </PageLayout>
  )
}
