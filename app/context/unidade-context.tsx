'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { setUnidadeCookieAction } from '@/app/actions/unidade'

export interface UnidadeOption {
  id: string
  nome: string
}

interface UnidadeContextValue {
  unidades: UnidadeOption[]
  unidadeAtual: UnidadeOption | null  // null = Todas
  setUnidade: (u: UnidadeOption | null) => void
}

const UnidadeContext = createContext<UnidadeContextValue>({
  unidades: [],
  unidadeAtual: null,
  setUnidade: () => {},
})

interface UnidadeProviderProps {
  children: ReactNode
  unidades: UnidadeOption[]
  initialUnidadeId: string | null
}

export function UnidadeProvider({ children, unidades, initialUnidadeId }: UnidadeProviderProps) {
  const router = useRouter()
  const pathname = usePathname()

  const unidadeAtual: UnidadeOption | null =
    (initialUnidadeId && unidades.find((u) => u.id === initialUnidadeId)) || null

  async function setUnidade(u: UnidadeOption | null) {
    await setUnidadeCookieAction(u?.id ?? null)
    // Reload sem query params para que o server component releia o cookie
    router.replace(pathname)
    router.refresh()
  }

  return (
    <UnidadeContext.Provider value={{ unidades, unidadeAtual, setUnidade }}>
      {children}
    </UnidadeContext.Provider>
  )
}

export const useUnidade = () => useContext(UnidadeContext)
