'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { setEmpresaCookieAction, type EmpresaOption } from '@/app/actions/empresa'

interface EmpresaContextValue {
  empresas: EmpresaOption[]
  empresaAtual: EmpresaOption | null   // null = Consolidado (todas)
  setEmpresa: (e: EmpresaOption | null) => Promise<void>
  isConsolidado: boolean
}

const EmpresaContext = createContext<EmpresaContextValue>({
  empresas: [],
  empresaAtual: null,
  setEmpresa: async () => {},
  isConsolidado: true,
})

interface EmpresaProviderProps {
  children: ReactNode
  empresas: EmpresaOption[]
  initialEmpresaId: string | null
}

export function EmpresaProvider({ children, empresas, initialEmpresaId }: EmpresaProviderProps) {
  const router = useRouter()
  const pathname = usePathname()

  const empresaAtual: EmpresaOption | null =
    (initialEmpresaId && empresas.find((e) => e.id === initialEmpresaId)) || null

  async function setEmpresa(e: EmpresaOption | null) {
    await setEmpresaCookieAction(e?.id ?? null)
    router.replace(pathname)
    router.refresh()
  }

  return (
    <EmpresaContext.Provider value={{
      empresas,
      empresaAtual,
      setEmpresa,
      isConsolidado: empresaAtual === null,
    }}>
      {children}
    </EmpresaContext.Provider>
  )
}

export const useEmpresa = () => useContext(EmpresaContext)
