'use client'

import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { getUserPermissionsAction } from '@/app/actions/permissoes'
import { getAcesso, isGlobalAdmin } from '@/app/lib/permissions'
import type { PermissaoMap, NivelAcesso } from '@/app/lib/permissions'

interface PermissionsContextValue {
  map: PermissaoMap
  isLoading: boolean
  isAdmin: boolean
  canAccess: (tela: string) => boolean
  getAcessoTela: (tela: string) => NivelAcesso | null
  unidadesPermitidas: string[] | null
  reload: () => void
}

const PermissionsContext = createContext<PermissionsContextValue>({
  map: {},
  isLoading: true,
  isAdmin: false,
  canAccess: () => true,
  getAcessoTela: () => null,
  unidadesPermitidas: null,
  reload: () => {},
})

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<PermissaoMap>({})
  const [isLoading, setIsLoading] = useState(true)
  // counter trick: incrementar força re-execução do useEffect sem chamar setState dentro dele
  const [tick, setTick] = useState(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    getUserPermissionsAction().then((result) => {
      if (!mountedRef.current) return
      setMap(result.data ?? {})
      setIsLoading(false)
    })
  }, [tick])

  const reload = useCallback(() => {
    setIsLoading(true)
    setTick((t) => t + 1)
  }, [])

  const admin = isGlobalAdmin(map)

  const unidadesPermitidas: string[] | null = admin
    ? null
    : Object.values(map)
        .filter((p) => p.unidade_id !== null)
        .map((p) => p.unidade_id as string)

  const value: PermissionsContextValue = {
    map,
    isLoading,
    isAdmin: admin,
    canAccess: (tela: string) => {
      if (isLoading) return true
      if (Object.keys(map).length === 0) return true
      if (admin) return true
      return getAcesso(map, tela) !== null
    },
    getAcessoTela: (tela: string) => getAcesso(map, tela),
    unidadesPermitidas,
    reload,
  }

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  )
}

export const usePermissions = () => useContext(PermissionsContext)

export function usePermission(tela: string) {
  const { getAcessoTela, isLoading, canAccess } = usePermissions()
  const acesso = getAcessoTela(tela)
  return {
    acesso,
    isLoading,
    canRead:  isLoading || canAccess(tela),
    canWrite: isLoading || acesso === 'escrita' || acesso === 'admin',
    isAdmin:  isLoading || acesso === 'admin',
  }
}
