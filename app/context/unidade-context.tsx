'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
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

  const unidadeAtual: UnidadeOption | null =
    (initialUnidadeId && unidades.find((u) => u.id === initialUnidadeId)) || null

  async function setUnidade(u: UnidadeOption | null) {
    await setUnidadeCookieAction(u?.id ?? null)
    // router.refresh() é suficiente: revalida os Server Components com o novo cookie
    // sem mudar URL. router.replace() seria uma navegação redundante → double fetch.
    router.refresh()
  }

  return (
    <UnidadeContext.Provider value={{ unidades, unidadeAtual, setUnidade }}>
      {children}
    </UnidadeContext.Provider>
  )
}

export const useUnidade = () => useContext(UnidadeContext)
