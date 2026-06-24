'use client'

import { Store } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useUnidade } from '@/app/context/unidade-context'
import { usePermissions } from '@/app/context/permissions-context'
import { TELAS } from '@/app/lib/permissions'
import type { TelaSlug } from '@/app/lib/permissions'

// /dashboard/receitas/... → 'receitas'
function pathnameToTela(pathname: string): TelaSlug | null {
  const segment = pathname.split('/')[2]
  return (TELAS as readonly string[]).includes(segment) ? (segment as TelaSlug) : null
}

export function UnidadeSelector() {
  const { unidades, unidadeAtual, setUnidade } = useUnidade()
  const { unidadesPermitidas, isLoading, isAdmin, map } = usePermissions()
  const pathname = usePathname()

  if (unidades.length === 0) return null

  let visíveis: typeof unidades

  if (isLoading || isAdmin) {
    visíveis = unidades
  } else {
    const telaAtual = pathnameToTela(pathname)

    if (telaAtual) {
      const permDaTela = map[telaAtual]
      if (!permDaTela) {
        // Sem permissão para esta tela
        visíveis = []
      } else if (permDaTela.unidade_id === null) {
        // Permissão global — mostra todas as unidades acessíveis
        visíveis = unidadesPermitidas === null
          ? unidades
          : unidades.filter((u) => unidadesPermitidas.includes(u.id))
      } else {
        // Permissão específica para uma unidade — mostra só ela
        visíveis = unidades.filter((u) => u.id === permDaTela.unidade_id)
      }
    } else {
      // Página sem tela mapeada (configuracoes, raiz) — filtro geral
      visíveis = unidadesPermitidas === null
        ? unidades
        : unidades.filter((u) => unidadesPermitidas.includes(u.id))
    }
  }

  if (visíveis.length === 0) return null

  // Com exatamente 1 unidade: badge estático (sem troca)
  if (visíveis.length === 1) {
    return (
      <div className="flex items-center gap-1.5 mb-4 px-1">
        <Store size={11} className="text-accent-primary" />
        <span className="text-xs font-medium text-accent-primary">{visíveis[0].nome}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-0.5 mb-4 border-b border-subtle pb-0">
      {visíveis.map((tab) => {
        const ativa = tab.id === (unidadeAtual?.id ?? null)
        return (
          <button
            key={tab.id}
            onClick={() => setUnidade({ id: tab.id, nome: tab.nome })}
            className={`
              flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all relative
              ${ativa
                ? 'text-accent-primary'
                : 'text-secondary hover:text-ink-soft hover:bg-input/40 rounded-t-lg'
              }
            `}
          >
            <Store size={13} className={ativa ? 'text-accent-primary' : 'text-faint'} />
            {tab.nome}
            {ativa && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent-primary rounded-t-full" />
            )}
          </button>
        )
      })}
    </div>
  )
}
