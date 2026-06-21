'use client'

import { Store } from 'lucide-react'
import { useUnidade } from '@/app/context/unidade-context'
import { usePermissions } from '@/app/context/permissions-context'

export function UnidadeSelector() {
  const { unidades, unidadeAtual, setUnidade } = useUnidade()
  const { unidadesPermitidas, isLoading } = usePermissions()

  if (unidades.length === 0) return null

  const visíveis = (!isLoading && unidadesPermitidas !== null)
    ? unidades.filter((u) => unidadesPermitidas.includes(u.id))
    : unidades

  // Com exatamente 1 unidade: mostra badge informativo (sem troca)
  if (visíveis.length === 1) {
    return (
      <div className="flex items-center gap-1.5 mb-4 px-1">
        <Store size={11} className="text-faint" />
        <span className="text-xs text-secondary">{visíveis[0].nome}</span>
      </div>
    )
  }

  const tabs = [{ id: null, nome: 'Todas' }, ...visíveis]

  return (
    <div className="flex items-center gap-0.5 mb-4 border-b border-subtle pb-0">
      {tabs.map((tab) => {
        const ativa = tab.id === (unidadeAtual?.id ?? null)
        return (
          <button
            key={tab.id ?? '__todas__'}
            onClick={() => setUnidade(tab.id ? { id: tab.id, nome: tab.nome } : null)}
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
