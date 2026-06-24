'use client'

import { Store } from 'lucide-react'
import { useUnidade } from '@/app/context/unidade-context'
import { usePermissions } from '@/app/context/permissions-context'

// Paleta de cores por posição de unidade (dark-friendly, distintas entre si)
const UNIT_COLORS: { bg: string; border: string; text: string; dot: string }[] = [
  { bg: 'rgba(74,158,186,0.15)',  border: 'rgba(74,158,186,0.4)',  text: '#4a9eba', dot: '#4a9eba' },  // teal
  { bg: 'rgba(155,89,182,0.15)', border: 'rgba(155,89,182,0.4)', text: '#b07edd', dot: '#b07edd' },  // roxo
  { bg: 'rgba(39,174,96,0.15)',  border: 'rgba(39,174,96,0.4)',  text: '#4ec97a', dot: '#4ec97a' },  // verde
  { bg: 'rgba(217,141,95,0.15)', border: 'rgba(217,141,95,0.4)', text: '#d98d5f', dot: '#d98d5f' },  // croissant
]

function getUnitColor(index: number) {
  return UNIT_COLORS[index % UNIT_COLORS.length]
}

export function UnidadeSelector() {
  const { unidades, unidadeAtual, setUnidade } = useUnidade()
  const { unidadesPermitidas, isLoading } = usePermissions()

  if (unidades.length === 0) return null

  const visíveis = (!isLoading && unidadesPermitidas !== null)
    ? unidades.filter((u) => unidadesPermitidas.includes(u.id))
    : unidades

  // Índice global da unidade (para manter cor consistente independente de qual é ativa)
  function colorIndex(unitId: string) {
    return unidades.findIndex((u) => u.id === unitId)
  }

  // Com exatamente 1 unidade visível: mostra badge grande (sem botão de troca)
  if (visíveis.length === 1) {
    const idx = colorIndex(visíveis[0].id)
    const c = getUnitColor(idx)
    return (
      <div
        className="flex items-center gap-2 mb-4 px-3 py-1.5 rounded-lg border text-sm font-medium"
        style={{ background: c.bg, borderColor: c.border, color: c.text }}
      >
        <span style={{ color: c.dot }}>
          <Store size={13} />
        </span>
        {visíveis[0].nome}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 mb-4 flex-wrap">
      {visíveis.map((tab) => {
        const ativa = tab.id === (unidadeAtual?.id ?? null)
        const idx = colorIndex(tab.id)
        const c = getUnitColor(idx)

        return (
          <button
            key={tab.id}
            onClick={() => setUnidade({ id: tab.id, nome: tab.nome })}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border"
            style={
              ativa
                ? {
                    background: c.bg,
                    borderColor: c.border,
                    color: c.text,
                    boxShadow: `0 0 0 1px ${c.border}`,
                  }
                : {
                    background: 'transparent',
                    borderColor: 'var(--color-border-subtle)',
                    color: 'var(--color-text-secondary)',
                  }
            }
          >
            {/* Bolinha colorida indicadora */}
            <span
              className="w-2 h-2 rounded-full flex-shrink-0 transition-all"
              style={{
                background: ativa ? c.dot : 'var(--color-text-faint)',
                boxShadow: ativa ? `0 0 6px ${c.dot}` : 'none',
              }}
            />
            <Store size={13} style={{ opacity: ativa ? 1 : 0.5 }} />
            {tab.nome}
          </button>
        )
      })}
    </div>
  )
}

// Exporta cores por unidade para usar em outras partes da UI (ex.: banner de página)
export { getUnitColor, UNIT_COLORS }
