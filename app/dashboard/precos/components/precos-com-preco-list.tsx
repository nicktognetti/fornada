'use client'

import { useState } from 'react'
import { formatBRL } from '@/lib/format'
import type { ProdutoFinanceiro } from '@/app/actions/painel'
import { ProdutoDetalheDrawer } from '@/app/components/produto-detalhe-drawer'

/**
 * Lista clicável dos produtos já precificados (seção "Com preço definido"
 * da tela de Preços). Cada linha abre o drawer de detalhe do produto.
 */
export function PrecosComPrecoList({ produtos }: { produtos: ProdutoFinanceiro[] }) {
  const [detalheId, setDetalheId] = useState<string | null>(null)

  return (
    <>
      <div className="space-y-2">
        {produtos.map((p) => {
          const prejuizo = p.margem_percentual < 0
          return (
            <div
              key={p.produto_id}
              onClick={() => setDetalheId(p.produto_id)}
              title="Ver detalhe do produto"
              className="card-surface px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-input transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="font-playfair text-primary text-[17px] font-semibold leading-tight truncate">
                  {p.produto_nome}
                </p>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <span className="text-secondary text-xs">custo: R$ {formatBRL(p.custo_total)}</span>
                  <span className="text-secondary text-xs">
                    preço: <span className="text-primary">R$ {formatBRL(p.preco_venda)}</span>
                  </span>
                  {p.unidade_nome && <span className="text-faint text-xs">{p.unidade_nome}</span>}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className={`font-playfair text-[22px] font-bold leading-none tabular-nums ${prejuizo ? 'text-red-400' : 'text-emerald-400'}`}>
                  {p.margem_percentual.toFixed(1)}%
                </p>
                <p className={`text-[11px] mt-0.5 ${prejuizo ? 'text-red-400/70' : 'text-emerald-400/70'}`}>
                  {prejuizo ? 'PREJUÍZO' : 'margem'}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <ProdutoDetalheDrawer produtoId={detalheId} onClose={() => setDetalheId(null)} />
    </>
  )
}
