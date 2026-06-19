'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

export interface UnidadeOption {
  id: string
  nome: string
}

interface UnidadeContextValue {
  unidades: UnidadeOption[]
  unidadeAtual: UnidadeOption | null
  setUnidade: (u: UnidadeOption) => void
}

const UnidadeContext = createContext<UnidadeContextValue>({
  unidades: [],
  unidadeAtual: null,
  setUnidade: () => {},
})

interface UnidadeProviderProps {
  children: ReactNode
  unidades: UnidadeOption[]
}

export function UnidadeProvider({ children, unidades }: UnidadeProviderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Derivado diretamente de searchParams — sem useState, sem useEffect
  const idFromUrl = searchParams.get('unidade')
  const unidadeAtual: UnidadeOption | null =
    (idFromUrl && unidades.find((u) => u.id === idFromUrl)) || unidades[0] || null

  function setUnidade(u: UnidadeOption) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('unidade', u.id)
    router.replace(`${pathname}?${params.toString()}`)
  }

  return (
    <UnidadeContext.Provider value={{ unidades, unidadeAtual, setUnidade }}>
      {children}
    </UnidadeContext.Provider>
  )
}

export const useUnidade = () => useContext(UnidadeContext)
