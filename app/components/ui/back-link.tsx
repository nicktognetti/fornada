'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  fallbackHref: string
  children: ReactNode
  className?: string
}

/**
 * "Voltar" que preserva a posição: usa o histórico do navegador quando a
 * página anterior é do próprio app (o browser restaura o scroll e a lista
 * restaura filtros via sessionStorage). Acesso direto (link externo,
 * refresh) cai no fallback.
 */
export function BackLink({ fallbackHref, children, className }: Props) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) router.back()
        else if (window.history.length > 1) router.back()
        else router.push(fallbackHref)
      }}
      className={className}
    >
      <ArrowLeft size={15} />
      {children}
    </button>
  )
}
