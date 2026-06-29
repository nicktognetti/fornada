'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle } from 'lucide-react'
import { formatBRL } from '@/lib/format'
import { KpiDetalheDrawer, type KpiTipo } from './kpi-detalhe-drawer'
import type { PainelIndicadores, ProdutoFinanceiro } from '@/app/actions/painel'
import type { AlertaFiltro } from './painel-client'

interface Props {
  indicadores: PainelIndicadores
  fichas: ProdutoFinanceiro[]
  alertaFiltro: AlertaFiltro
  onAlertaClick: (faixa: AlertaFiltro) => void
}

function classifyFaixa(custo: number): 'alta' | 'media' | 'baixa' {
  if (custo > 5) return 'alta'
  if (custo > 1) return 'media'
  return 'baixa'
}

export function PainelKpis({ indicadores: ind, fichas, alertaFiltro, onAlertaClick }: Props) {
  const [kpiDrawer, setKpiDrawer] = useState<KpiTipo | null>(null)
  // Produtos sem preço, agrupados por faixa de custo
  const semPreco = fichas.filter((f) => f.preco_venda <= 0 && f.custo_total > 0)
  const contagem = { alta: 0, media: 0, baixa: 0 }
  for (const f of semPreco) contagem[classifyFaixa(f.custo_total)]++

  const alertas: { faixa: AlertaFiltro; dot: string; label: string; desc: string }[] = [
    {
      faixa: 'alta',
      dot: 'bg-danger',
      label: `${contagem.alta} produto${contagem.alta !== 1 ? 's' : ''}`,
      desc: 'custo > R$ 5 sem preço',
    },
    {
      faixa: 'media',
      dot: 'bg-amber-400',
      label: `${contagem.media} produto${contagem.media !== 1 ? 's' : ''}`,
      desc: 'custo R$ 1–5 sem preço',
    },
    {
      faixa: 'baixa',
      dot: 'bg-success',
      label: `${contagem.baixa} produto${contagem.baixa !== 1 ? 's' : ''}`,
      desc: 'custo < R$ 1 sem preço',
    },
  ]

  const totalAlertas = semPreco.length + ind.produtos_margem_negativa

  return (
    <>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

      {/* Faturamento estimado */}
      <div
        onClick={() => setKpiDrawer('portfolio')}
        title="Ver composição do portfólio"
        className="card-surface px-4 py-4 cursor-pointer hover:bg-input/40 transition-colors"
      >
        <div className="flex items-center gap-2 mb-3">
          <DollarSign size={13} className="text-accent-primary shrink-0" />
          <p
            className="text-[10px] font-semibold uppercase tracking-wider text-secondary border-b border-dashed border-subtle/60 cursor-help"
            title="Soma dos preços de venda cadastrados. NÃO é faturamento real, que depende do volume vendido."
          >
            Valor do Portfólio
          </p>
        </div>
        <p className="font-playfair font-bold text-2xl tabular-nums leading-tight mb-1 text-accent-primary">
          {ind.produtos_com_preco > 0 ? `R$ ${formatBRL(ind.valor_portfolio)}` : '—'}
        </p>
        <p className="text-[11px] text-faint">
          {ind.produtos_com_preco} produto{ind.produtos_com_preco !== 1 ? 's' : ''} com preço
        </p>
      </div>

      {/* Custo total */}
      <div
        onClick={() => setKpiDrawer('custo')}
        title="Ver custo por produto"
        className="card-surface px-4 py-4 cursor-pointer hover:bg-input/40 transition-colors"
      >
        <div className="flex items-center gap-2 mb-3">
          <TrendingDown size={13} className="text-secondary shrink-0" />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary">
            Custo Total
          </p>
        </div>
        <p className="font-playfair font-bold text-2xl tabular-nums leading-tight mb-1 text-primary">
          {ind.total_produtos > 0 ? `R$ ${formatBRL(ind.custo_total_geral)}` : '—'}
        </p>
        <p className="text-[11px] text-faint">
          {ind.total_produtos} produto{ind.total_produtos !== 1 ? 's' : ''} ativos
        </p>
      </div>

      {/* Margem média */}
      <div
        onClick={() => setKpiDrawer('margem')}
        title="Entender o cálculo da margem"
        className="card-surface px-4 py-4 cursor-pointer hover:bg-input/40 transition-colors"
      >
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={13} className={`shrink-0 ${
            ind.margem_media_percentual >= 40 ? 'text-success' :
            ind.margem_media_percentual >= 20 ? 'text-amber-400' : 'text-danger'
          }`} />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary">
            Margem Média
          </p>
        </div>
        <p className={`font-playfair font-bold text-2xl tabular-nums leading-tight mb-1 ${
          ind.produtos_com_preco === 0 ? 'text-faint' :
          ind.margem_media_percentual >= 40 ? 'text-success' :
          ind.margem_media_percentual >= 20 ? 'text-amber-400' : 'text-danger'
        }`}>
          {ind.produtos_com_preco > 0 ? `${ind.margem_media_percentual.toFixed(1)}%` : '—'}
        </p>
        {ind.produtos_com_preco > 0 && (
          <div className="flex items-center gap-1 mt-0.5" title="Margem ponderada pelo valor do portfólio: produtos mais caros têm maior peso">
            <p className="text-[11px] text-faint">
              ponderada:{' '}
              <span className={`font-medium tabular-nums ${
                ind.margem_ponderada_percentual >= 40 ? 'text-success' :
                ind.margem_ponderada_percentual >= 20 ? 'text-amber-400' : 'text-danger'
              }`}>
                {ind.margem_ponderada_percentual.toFixed(1)}%
              </span>
            </p>
          </div>
        )}
        {ind.produtos_com_preco === 0 && (
          <p className="text-[11px] text-faint">sobre preço de venda</p>
        )}
      </div>

      {/* Alertas priorizados */}
      <div className="card-surface px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={13} className={`shrink-0 ${totalAlertas > 0 ? 'text-danger' : 'text-success'}`} />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary">
              Sem Preço
            </p>
          </div>
          {alertaFiltro && (
            <button
              onClick={() => onAlertaClick(null)}
              className="text-[9px] text-faint hover:text-secondary border border-subtle rounded px-1.5 py-0.5 transition-colors"
            >
              limpar
            </button>
          )}
        </div>

        {semPreco.length === 0 ? (
          <>
            <p className="font-playfair font-bold text-2xl leading-tight mb-1 text-success">✓ OK</p>
            <p className="text-[11px] text-faint">todos precificados</p>
          </>
        ) : (
          <div className="space-y-1.5">
            {alertas.map(({ faixa, dot, label, desc }) => {
              const count = contagem[faixa as keyof typeof contagem]
              const active = alertaFiltro === faixa
              return (
                <button
                  key={faixa}
                  onClick={() => onAlertaClick(faixa)}
                  disabled={count === 0}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all group ${
                    count === 0
                      ? 'opacity-30 cursor-default'
                      : active
                      ? 'bg-input ring-1 ring-subtle'
                      : 'hover:bg-input/60'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                  <span className={`text-[11px] font-semibold tabular-nums ${
                    faixa === 'alta' ? 'text-danger' :
                    faixa === 'media' ? 'text-amber-400' : 'text-success'
                  }`}>
                    {label}
                  </span>
                  <span className="text-[10px] text-faint truncate flex-1">{desc}</span>
                  {active && <span className="text-[9px] text-accent-primary shrink-0">●</span>}
                </button>
              )
            })}
            {ind.produtos_margem_negativa > 0 && (
              <p className="text-[10px] text-faint pt-0.5 pl-2">
                +{ind.produtos_margem_negativa} com margem negativa
              </p>
            )}
          </div>
        )}
      </div>

    </div>

    <KpiDetalheDrawer kpi={kpiDrawer} onClose={() => setKpiDrawer(null)} fichas={fichas} indicadores={ind} />
    </>
  )
}
