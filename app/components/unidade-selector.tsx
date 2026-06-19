'use client'

import { useUnidade } from '@/app/context/unidade-context'
import { usePermissions } from '@/app/context/permissions-context'

export function UnidadeSelector() {
  const { unidades, unidadeAtual, setUnidade } = useUnidade()
  const { unidadesPermitidas, isLoading } = usePermissions()

  if (unidades.length === 0) return null

  // Filtra unidades conforme permissões (null = todas; array = só as listadas)
  const visíveis = (!isLoading && unidadesPermitidas !== null)
    ? unidades.filter((u) => unidadesPermitidas.includes(u.id))
    : unidades

  // Se só há uma unidade visível, oculta o seletor (não há escolha)
  if (visíveis.length <= 1) return null

  return (
    <div className="flex items-center gap-5 mb-6">
      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-secondary/60 shrink-0">
        UNIDADE
      </span>
      <div className="flex items-center gap-3 flex-wrap">
        {visíveis.map((u) => {
          const ativa = u.id === unidadeAtual?.id
          return (
            <button
              key={u.id}
              onClick={() => setUnidade(u)}
              className={`flex items-center gap-2 text-sm transition-colors ${
                ativa ? 'text-primary' : 'text-secondary hover:text-ink-soft'
              }`}
            >
              {ativa && (
                <span className="h-2 w-2 rounded-full bg-accent-primary shrink-0" />
              )}
              {u.nome}
            </button>
          )
        })}
      </div>
    </div>
  )
}
