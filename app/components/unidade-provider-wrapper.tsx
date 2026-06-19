'use client'

import { UnidadeProvider, type UnidadeOption } from '@/app/context/unidade-context'
import { Suspense, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  unidades: UnidadeOption[]
}

// Suspense é obrigatório porque UnidadeProvider usa useSearchParams()
export function UnidadeProviderWrapper({ children, unidades }: Props) {
  return (
    <Suspense>
      <UnidadeProvider unidades={unidades}>
        {children}
      </UnidadeProvider>
    </Suspense>
  )
}
