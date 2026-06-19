'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
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

  const [unidadeAtual, setUnidadeAtual] = useState<UnidadeOption | null>(() => {
    const idFromUrl = searchParams.get('unidade')
    if (idFromUrl) {
      const found = unidades.find((u) => u.id === idFromUrl)
      if (found) return found
    }
    return unidades[0] ?? null
  })

  // Sincroniza quando a URL muda externamente (ex: navegação com link)
  useEffect(() => {
    const idFromUrl = searchParams.get('unidade')
    if (!idFromUrl) return
    const found = unidades.find((u) => u.id === idFromUrl)
    if (found && found.id !== unidadeAtual?.id) {
      setUnidadeAtual(found)
    }
  }, [searchParams, unidades, unidadeAtual?.id])

  function setUnidade(u: UnidadeOption) {
    setUnidadeAtual(u)
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
