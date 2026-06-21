'use client'

import { UnidadeProvider, type UnidadeOption } from '@/app/context/unidade-context'
import { type ReactNode } from 'react'

interface Props {
  children: ReactNode
  unidades: UnidadeOption[]
  initialUnidadeId: string | null
}

export function UnidadeProviderWrapper({ children, unidades, initialUnidadeId }: Props) {
  return (
    <UnidadeProvider unidades={unidades} initialUnidadeId={initialUnidadeId}>
      {children}
    </UnidadeProvider>
  )
}
