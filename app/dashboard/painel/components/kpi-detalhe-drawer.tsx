'use client'

import { DollarSign, TrendingDown, TrendingUp } from 'lucide-react'
import { DetailDrawer } from '@/app/components/ui/detail-drawer'
import { formatBRL, valorPorGrande, unidadeGrande } from '@/lib/format'
import type { PainelIndicadores, ProdutoFinanceiro } from '@/app/actions/painel'

export type KpiTipo = 'portfolio' | 'custo' | 'margem'

interface Props {
  kpi: KpiTipo | null
  onClose: () => void
  fichas: ProdutoFinanceiro[]
  indicadores: PainelIndicadores
}

function margemColor(m: number) {
  if (m < 0) return 'text-danger'
  if (m < 20) return 'text-amber-400'
  return 'text-success'
}

const CONFIG = {
  portfolio: { title: 'Valor do Portfólio', subtitle: 'Soma dos preços de venda', icon: DollarSign },
  custo:     { title: 'Custo Total', subtitle: 'Soma dos custos de produção', icon: TrendingDown },
  margem:    { title: 'Margem Média', subtitle: 'Como a margem é calculada', icon: TrendingUp },
} as const

export function KpiDetalheDrawer({ kpi, onClose, fichas, indicadores: ind }: Props) {
  const cfg = kpi ? CONFIG[kpi] : null

  function Linha({ nome, valor, cls }: { nome: string; valor: string; cls?: string }) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-subtle last:border-0">
        <span className="text-sm text-primary truncate">{nome}</span>
        <span className={`text-sm font-medium tabular-nums shrink-0 ${cls ?? 'text-ink-soft'}`}>{valor}</span>
      </div>
    )
  }

  return (
    <DetailDrawer
      open={kpi !== null}
      onClose={onClose}
      title={cfg?.title ?? ''}
      subtitle={cfg?.subtitle}
      icon={cfg?.icon}
    >
      {kpi === 'portfolio' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-canvas border border-accent-primary/20 p-4">
            <p className="text-[10px] uppercase tracking-wider text-secondary">Total do portfólio</p>
            <p className="font-playfair text-3xl font-bold text-accent-primary tabular-nums leading-none mt-1">
              R$ {formatBRL(ind.valor_portfolio)}
            </p>
            <p className="text-[11px] text-faint mt-2">
              Soma dos preços de venda de {ind.produtos_com_preco} produto{ind.produtos_com_preco !== 1 ? 's' : ''} precificado{ind.produtos_com_preco !== 1 ? 's' : ''}. Não é faturamento real — depende do volume vendido.
            </p>
          </div>
          <div className="rounded-xl bg-surface border border-subtle overflow-hidden">
            {[...fichas].filter((f) => f.preco_venda > 0).sort((a, b) => valorPorGrande(b.preco_venda, b.rendimento_unidade) - valorPorGrande(a.preco_venda, a.rendimento_unidade))
              .map((f) => <Linha key={f.produto_id} nome={f.produto_nome} valor={`R$ ${formatBRL(valorPorGrande(f.preco_venda, f.rendimento_unidade))}/${unidadeGrande(f.rendimento_unidade)}`} cls="text-primary" />)}
          </div>
        </div>
      )}

      {kpi === 'custo' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-canvas border border-subtle p-4">
            <p className="text-[10px] uppercase tracking-wider text-secondary">Custo total dos produtos</p>
            <p className="font-playfair text-3xl font-bold text-primary tabular-nums leading-none mt-1">
              R$ {formatBRL(ind.custo_total_geral)}
            </p>
            <p className="text-[11px] text-faint mt-2">
              Soma do custo de produção/compra de {ind.total_produtos} produto{ind.total_produtos !== 1 ? 's' : ''} ativo{ind.total_produtos !== 1 ? 's' : ''}.
            </p>
          </div>
          <div className="rounded-xl bg-surface border border-subtle overflow-hidden">
            {[...fichas].filter((f) => f.custo_total > 0).sort((a, b) => valorPorGrande(b.custo_total, b.rendimento_unidade) - valorPorGrande(a.custo_total, a.rendimento_unidade))
              .map((f) => <Linha key={f.produto_id} nome={f.produto_nome} valor={`R$ ${formatBRL(valorPorGrande(f.custo_total, f.rendimento_unidade))}/${unidadeGrande(f.rendimento_unidade)}`} />)}
          </div>
        </div>
      )}

      {kpi === 'margem' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-canvas border border-subtle p-4">
              <p className="text-[10px] uppercase tracking-wider text-secondary">Margem média</p>
              <p className={`font-playfair text-2xl font-bold tabular-nums leading-none mt-1 ${margemColor(ind.margem_media_percentual)}`}>
                {ind.margem_media_percentual.toFixed(1)}%
              </p>
              <p className="text-[10px] text-faint mt-1">média simples</p>
            </div>
            <div className="rounded-xl bg-canvas border border-subtle p-4">
              <p className="text-[10px] uppercase tracking-wider text-secondary">Ponderada</p>
              <p className={`font-playfair text-2xl font-bold tabular-nums leading-none mt-1 ${margemColor(ind.margem_ponderada_percentual)}`}>
                {ind.margem_ponderada_percentual.toFixed(1)}%
              </p>
              <p className="text-[10px] text-faint mt-1">pelo valor de venda</p>
            </div>
          </div>
          <p className="text-[11px] text-faint">
            A <strong className="text-secondary">simples</strong> trata todos os produtos igual. A <strong className="text-secondary">ponderada</strong> dá mais peso aos produtos de maior preço (reflete melhor o resultado real).
          </p>
          <div className="rounded-xl bg-surface border border-subtle overflow-hidden">
            {[...fichas].filter((f) => f.preco_venda > 0).sort((a, b) => b.margem_percentual - a.margem_percentual)
              .map((f) => (
                <Linha key={f.produto_id} nome={f.produto_nome}
                  valor={`${f.margem_percentual.toFixed(1)}%`}
                  cls={margemColor(f.margem_percentual)} />
              ))}
          </div>
        </div>
      )}
    </DetailDrawer>
  )
}
