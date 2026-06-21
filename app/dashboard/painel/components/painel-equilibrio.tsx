'use client'

import { Scale } from 'lucide-react'
import { formatBRL } from '@/lib/format'

interface Props {
  totalDespesas: number
  margemMedia: number
  precoMedio: number
  valorPortfolio: number
}

export function PainelEquilibrio({ totalDespesas, margemMedia, precoMedio, valorPortfolio }: Props) {
  // Ponto de equilíbrio: despesas / (margem% / 100)
  const temDespesas = totalDespesas > 0
  const temMargem   = margemMedia > 0

  if (!temDespesas) {
    return (
      <div className="card-surface px-5 py-4">
        <div className="flex items-center gap-2 mb-2">
          <Scale size={13} className="text-faint shrink-0" />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary">
            Ponto de Equilíbrio
          </p>
        </div>
        <p className="text-sm text-faint">
          Cadastre suas despesas fixas para calcular o ponto de equilíbrio.
        </p>
      </div>
    )
  }

  if (!temMargem) {
    return (
      <div className="card-surface px-5 py-4">
        <div className="flex items-center gap-2 mb-2">
          <Scale size={13} className="text-faint shrink-0" />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary">
            Ponto de Equilíbrio
          </p>
        </div>
        <p className="text-sm text-faint">
          Precifique seus produtos para calcular o ponto de equilíbrio.
        </p>
      </div>
    )
  }

  const pontoRS   = totalDespesas / (margemMedia / 100)
  const pontoUni  = precoMedio > 0 ? Math.ceil(pontoRS / precoMedio) : null
  const delta     = valorPortfolio - pontoRS
  const deltaPct  = pontoRS > 0 ? (delta / pontoRS) * 100 : 0
  const acima     = delta >= 0

  return (
    <div className="card-surface px-5 py-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-accent-primary/10 flex items-center justify-center shrink-0">
          <Scale size={14} className="text-accent-primary" />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary">
            Ponto de Equilíbrio
          </p>
          <p className="text-[11px] text-faint">despesas fixas / margem média</p>
        </div>
      </div>

      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <p className="text-[10px] text-faint mb-0.5">Equilíbrio (R$)</p>
          <p className="font-playfair font-bold text-2xl tabular-nums text-primary leading-tight">
            R$ {formatBRL(pontoRS)}
          </p>
        </div>
        {pontoUni !== null && (
          <div>
            <p className="text-[10px] text-faint mb-0.5">Equilíbrio (unid.)</p>
            <p className="font-playfair font-bold text-xl tabular-nums text-secondary leading-tight">
              {pontoUni.toLocaleString('pt-BR')}
            </p>
          </div>
        )}
      </div>

      {/* Indicador relativo ao portfólio */}
      <div className={`mt-3 flex items-center gap-1.5 text-[11px] ${acima ? 'text-success' : 'text-danger'}`}>
        <span className="text-base leading-none">{acima ? '▲' : '▼'}</span>
        <span className="font-semibold">
          {acima ? 'Portfólio' : 'Falta'} R$ {formatBRL(Math.abs(delta))}
          {' '}({Math.abs(deltaPct).toFixed(0)}%{' '}
          {acima ? 'acima do ponto de equilíbrio' : 'abaixo do ponto de equilíbrio'})
        </span>
      </div>

      <p className="text-[10px] text-faint mt-2">
        Despesas: R$ {formatBRL(totalDespesas)}/mês · Margem média: {margemMedia.toFixed(1)}%
      </p>
    </div>
  )
}
