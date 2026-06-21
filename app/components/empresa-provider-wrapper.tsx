'use client'

import { EmpresaProvider } from '@/app/context/empresa-context'
import type { EmpresaOption } from '@/app/actions/empresa'
import { type ReactNode } from 'react'

interface Props {
  children: ReactNode
  empresas: EmpresaOption[]
  initialEmpresaId: string | null
}

export function EmpresaProviderWrapper({ children, empresas, initialEmpresaId }: Props) {
  return (
    <EmpresaProvider empresas={empresas} initialEmpresaId={initialEmpresaId}>
      {children}
    </EmpresaProvider>
  )
}
