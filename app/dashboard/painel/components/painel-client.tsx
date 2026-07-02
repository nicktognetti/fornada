'use client'

import { useState } from 'react'
import { Target, BarChart2, SlidersHorizontal } from 'lucide-react'
import { SectionLabel } from '@/app/components/ui/section-label'
import { PainelKpis } from './painel-kpis'
import { PainelTabela } from './painel-tabela'
import { PainelGraficos } from './painel-graficos'
import { PainelPrecificacao } from './painel-precificacao'
import { PainelMeta } from './painel-meta'
import { PainelDespesas } from './painel-despesas'
import { PainelEquilibrio } from './painel-equilibrio'
import { PainelAlertas } from './painel-alertas'
import type { ProdutoFinanceiro, PainelIndicadores, DespesaFixa } from '@/app/actions/painel'
import type { MetaFaturamento } from '@/app/actions/empresa'

export type AlertaFiltro = 'alta' | 'media' | 'baixa' | null

export type ChartFilter =
  | { tipo: 'produto'; id: string; label: string }
  | { tipo: 'faixa_margem'; min: number; max: number; label: string }
  | null

interface Props {
  fichas: ProdutoFinanceiro[]
  indicadores: PainelIndicadores
  meta: MetaFaturamento | null
  despesas: DespesaFixa[]
}

export function PainelClient({ fichas, indicadores, meta, despesas: despesasIniciais }: Props) {
  const [alertaFiltro, setAlertaFiltro] = useState<AlertaFiltro>(null)
  const [chartFilter, setChartFilter] = useState<ChartFilter>(null)
  const [despesas, setDespesas] = useState<DespesaFixa[]>(despesasIniciais)

  function toggleAlerta(faixa: AlertaFiltro) {
    setChartFilter(null)
    setAlertaFiltro((prev) => (prev === faixa ? null : faixa))
  }

  function handleChartFilter(f: ChartFilter) {
    setAlertaFiltro(null)
    setChartFilter((prev) => {
      if (!f) return null
      if (!prev) return f
      if (f.tipo === 'produto' && prev.tipo === 'produto' && prev.id === f.id) return null
      if (f.tipo === 'faixa_margem' && prev.tipo === 'faixa_margem' && prev.min === f.min) return null
      return f
    })
  }

  const totalDespesas = despesas.reduce((s, d) => s + d.valor, 0)
  const margemMedia   = indicadores.margem_media_percentual
  const precoMedio    = indicadores.produtos_com_preco > 0
    ? indicadores.valor_portfolio / indicadores.produtos_com_preco
    : 0
  const pontoEquilibrio = totalDespesas > 0 && margemMedia > 0
    ? totalDespesas / (margemMedia / 100)
    : null

  return (
    <>
      {/* Visão geral — KPIs */}
      <PainelKpis
        indicadores={indicadores}
        fichas={fichas}
        alertaFiltro={alertaFiltro}
        onAlertaClick={toggleAlerta}
      />

      {/* Metas e equilíbrio */}
      <section className="space-y-3">
        <SectionLabel icon={Target}>Metas e equilíbrio</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {meta && <PainelMeta meta={meta} />}
          <PainelEquilibrio
            totalDespesas={totalDespesas}
            margemMedia={margemMedia}
            precoMedio={precoMedio}
            valorPortfolio={indicadores.valor_portfolio}
          />
        </div>
      </section>

      {/* Alertas inteligentes (tem cabeçalho próprio) */}
      <PainelAlertas
        fichas={fichas}
        indicadores={indicadores}
        pontoEquilibrio={pontoEquilibrio}
      />

      {/* Análise de margem */}
      {fichas.length > 0 && (
        <section className="space-y-3">
          <SectionLabel icon={BarChart2}>Análise de margem</SectionLabel>
          <PainelGraficos
            fichas={fichas}
            chartFilter={chartFilter}
            onChartFilter={handleChartFilter}
          />
        </section>
      )}

      {/* Produtos (a tabela tem sua própria barra de título) */}
      <PainelTabela
        fichas={fichas}
        alertaFiltro={alertaFiltro}
        chartFilter={chartFilter}
        onClearChartFilter={() => setChartFilter(null)}
      />

      {/* Custos fixos e precificação */}
      <section className="space-y-3">
        <SectionLabel icon={SlidersHorizontal}>Custos fixos e precificação</SectionLabel>
        <PainelDespesas despesas={despesas} onDespesasChange={setDespesas} />
        {fichas.length > 0 && <PainelPrecificacao fichas={fichas} />}
      </section>
    </>
  )
}
