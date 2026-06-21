'use client'

import { Building2 } from 'lucide-react'
import { useEmpresa } from '@/app/context/empresa-context'

export function EmpresaSwitcher() {
  const { empresas, empresaAtual, setEmpresa } = useEmpresa()

  // Com uma só empresa não precisa de switcher
  if (empresas.length <= 1) return null

  const ativoId = empresaAtual?.id ?? null

  return (
    <div className="flex items-center gap-0.5 mb-1">
      {/* Consolidado: desabilitado até modo multi-empresa ser implementado */}
      <div
        className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-faint/50 border border-transparent cursor-not-allowed select-none"
        title="Visão consolidada em desenvolvimento"
      >
        <Building2 size={11} className="text-faint/40" />
        Consolidado
        <span className="ml-0.5 text-[8px] font-bold uppercase tracking-wide bg-amber-500/15 text-amber-400 border border-amber-500/20 px-1 py-0.5 rounded-full">
          Em breve
        </span>
      </div>

      {empresas.map((e) => {
        const ativa = e.id === ativoId
        return (
          <button
            key={e.id}
            onClick={() => setEmpresa({ id: e.id, slug: e.slug, nome: e.nome })}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              ${ativa
                ? 'bg-accent-primary/15 text-accent-primary border border-accent-primary/25'
                : 'text-secondary hover:text-primary hover:bg-input/50 border border-transparent'
              }
            `}
          >
            <Building2
              size={11}
              className={ativa ? 'text-accent-primary' : 'text-faint'}
            />
            {e.nome}
          </button>
        )
      })}
    </div>
  )
}
