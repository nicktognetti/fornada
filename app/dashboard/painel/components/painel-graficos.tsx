'use client'

import { useState } from 'react'
import type { ProdutoFinanceiro } from '@/app/actions/painel'
import { formatBRL } from '@/lib/format'
import { ProdutoDetalheDrawer } from '@/app/components/produto-detalhe-drawer'
import type { ChartFilter } from './painel-client'

interface Props {
  fichas: ProdutoFinanceiro[]
  chartFilter: ChartFilter
  onChartFilter: (f: ChartFilter) => void
}

const COLORS = [
  'var(--color-success)',
  'var(--color-accent-primary)',
  '#60a5fa', '#818cf8', '#a78bfa',
]

const MIN_PARA_GRAFICOS = 3

function GraficoVazio({ icon, titulo, desc }: { icon: string; titulo: string; desc: string }) {
  return (
    <div className="card-surface px-6 py-10 flex flex-col items-center text-center gap-3">
      <span className="text-3xl opacity-40">{icon}</span>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">{titulo}</p>
      <p className="text-[11px] text-faint max-w-[180px]">{desc}</p>
    </div>
  )
}

export function PainelGraficos({ fichas, chartFilter, onChartFilter }: Props) {
  const [detalheId, setDetalheId] = useState<string | null>(null)
  const comPreco = fichas.filter((f) => f.preco_venda > 0 && f.custo_total > 0)
  const totalProdutos = fichas.length
  const totalComPreco = comPreco.length

  if (fichas.length === 0) return null

  const topMargem = [...comPreco]
    .sort((a, b) => b.margem_percentual - a.margem_percentual)
    .slice(0, 10)
  const maxMargem = Math.max(...topMargem.map((f) => Math.abs(f.margem_percentual)), 1)

  const faixas = [
    { label: '< 0%',   min: -Infinity, max: 0,        minVal: -999 },
    { label: '0–20%',  min: 0,         max: 20,       minVal: 0    },
    { label: '20–40%', min: 20,        max: 40,       minVal: 20   },
    { label: '40–60%', min: 40,        max: 60,       minVal: 40   },
    { label: '> 60%',  min: 60,        max: Infinity, minVal: 60   },
  ]
  const dist = faixas.map((f) => ({
    ...f,
    count: comPreco.filter((r) => r.margem_percentual >= f.min && r.margem_percentual < f.max).length,
  }))
  const maxDist = Math.max(...dist.map((d) => d.count), 1)

  const custoTotal  = fichas.reduce((s, f) => s + f.custo_total, 0)
  const margemTotal = comPreco.reduce((s, f) => s + Math.max(f.margem_rs, 0), 0)
  const fatTotal    = custoTotal + margemTotal
  const percCusto   = fatTotal > 0 ? (custoTotal / fatTotal) * 100 : 100
  const degCusto    = (percCusto / 100) * 360

  function arcPath(startDeg: number, endDeg: number, r = 46, cx = 56, cy = 56) {
    const rad = (d: number) => (d - 90) * (Math.PI / 180)
    const x1 = cx + r * Math.cos(rad(startDeg))
    const y1 = cy + r * Math.sin(rad(startDeg))
    const x2 = cx + r * Math.cos(rad(endDeg))
    const y2 = cy + r * Math.sin(rad(endDeg))
    const large = endDeg - startDeg > 180 ? 1 : 0
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`
  }

  const poucosDados = comPreco.length < MIN_PARA_GRAFICOS

  // Helpers para estado ativo de filtro
  function isProdutoAtivo(id: string) {
    return chartFilter?.tipo === 'produto' && chartFilter.id === id
  }
  function isFaixaAtiva(minVal: number) {
    if (chartFilter?.tipo !== 'faixa_margem') return false
    // chartFilter.min usa sentinela -999 para faixa negativa (min real é -Infinity)
    return chartFilter.min === minVal
  }

  return (
    <>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

      {/* ── Top 10 por margem ───────────────────────��─────────────────── */}
      {poucosDados ? (
        <div className="md:col-span-2">
          <GraficoVazio icon="📊" titulo="Top 10 por Margem"
            desc={`Cadastre preços para ver o ranking. (${totalComPreco}/${totalProdutos} precificados)`} />
        </div>
      ) : (
        <div className="md:col-span-2 card-surface px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary">
              Top 10 por Margem
            </p>
            <p className="text-[10px] text-faint">clique para ver detalhe</p>
          </div>
          <div className="space-y-2">
            {topMargem.map((f, i) => {
              const pct = (Math.abs(f.margem_percentual) / maxMargem) * 100
              const neg = f.margem_percentual < 0
              const ativo = isProdutoAtivo(f.produto_id)
              const baseColor = neg ? 'var(--color-danger)' : COLORS[i % COLORS.length]

              return (
                <button
                  key={f.produto_id}
                  onClick={() => setDetalheId(f.produto_id)}
                  title="Ver detalhe do produto"
                  className={`w-full flex items-center gap-2 rounded-lg px-1 py-0.5 transition-all group ${
                    ativo ? 'bg-input ring-1 ring-subtle' : 'hover:bg-input/40'
                  }`}
                >
                  <span className="text-[11px] text-secondary w-4 text-right shrink-0">{i + 1}</span>
                  <span className="text-[11px] text-primary truncate w-36 shrink-0 text-left" title={f.produto_nome}>
                    {f.produto_nome.length > 22 ? f.produto_nome.slice(0, 22) + '…' : f.produto_nome}
                  </span>
                  {f.produto_tipo === 'revenda' && (
                    <span className="text-[8px] font-bold text-blue-400 shrink-0 bg-blue-500/10 px-1 rounded">R</span>
                  )}
                  <div className="flex-1 bg-surface-2 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: baseColor,
                        opacity: ativo ? 1 : 0.75,
                        boxShadow: ativo ? `0 0 6px ${baseColor}` : 'none',
                      }}
                    />
                  </div>
                  <span className={`text-[11px] tabular-nums w-14 text-right shrink-0 font-medium ${neg ? 'text-danger' : 'text-success'}`}>
                    {f.margem_percentual.toFixed(1)}%
                  </span>
                  {ativo && <span className="text-accent-primary text-[9px] shrink-0">●</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Donut custo × margem ──────────────────────────────────────── */}
      {poucosDados ? (
        <GraficoVazio icon="🥧" titulo="Custo × Margem"
          desc="Precifique os produtos para ver a distribuição." />
      ) : (
        <div className="card-surface px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary mb-3">
            Custo × Margem
          </p>
          <div className="flex flex-col items-center gap-4">
            <svg width="112" height="112" viewBox="0 0 112 112">
              {degCusto >= 360 ? (
                <circle cx="56" cy="56" r="46" fill="var(--color-danger)" opacity="0.85" />
              ) : degCusto <= 0 ? (
                <circle cx="56" cy="56" r="46" fill="var(--color-success)" opacity="0.85" />
              ) : (
                <>
                  <path d={arcPath(0, degCusto)} fill="var(--color-danger)" opacity="0.85" />
                  <path d={arcPath(degCusto, 360)} fill="var(--color-success)" opacity="0.85" />
                </>
              )}
              <circle cx="56" cy="56" r="28" fill="var(--color-surface)" />
              <text x="56" y="51" textAnchor="middle" fontSize="10" fill="var(--color-text-primary)" fontWeight="700">
                {totalComPreco}/{totalProdutos}
              </text>
              <text x="56" y="63" textAnchor="middle" fontSize="9" fill="var(--color-text-faint)">
                precificados
              </text>
            </svg>
            <div className="w-full space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'var(--color-danger)', opacity: 0.85 }} />
                  <span className="text-secondary">Custo</span>
                </span>
                <span className="tabular-nums text-primary">R$ {formatBRL(custoTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'var(--color-success)', opacity: 0.85 }} />
                  <span className="text-secondary">Margem</span>
                </span>
                <span className="tabular-nums text-primary">R$ {formatBRL(margemTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Histograma ────────────────────────────────────────────────── */}
      {poucosDados ? (
        <div className="md:col-span-3">
          <GraficoVazio icon="📈" titulo="Distribuição por Faixa de Margem"
            desc={`Cadastre pelo menos ${MIN_PARA_GRAFICOS} preços para ver a distribuição.`} />
        </div>
      ) : (
        <div className="card-surface px-4 py-4 md:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary">
              Distribuição por Faixa de Margem
            </p>
            <p className="text-[10px] text-faint">clique numa faixa para filtrar</p>
          </div>
          <div className="flex items-end gap-3 h-28">
            {dist.map((d) => {
              const h = maxDist > 0 ? (d.count / maxDist) * 100 : 0
              const isNeg = d.label.startsWith('<')
              const ativo = isFaixaAtiva(d.min === -Infinity ? -999 : d.min)
              const barColor = isNeg ? 'var(--color-danger)' : 'var(--color-success)'

              return (
                <button
                  key={d.label}
                  disabled={d.count === 0}
                  onClick={() => onChartFilter({
                    tipo: 'faixa_margem',
                    min: d.min === -Infinity ? -999 : d.min,
                    max: d.max === Infinity ? 999 : d.max,
                    label: `margem ${d.label}`,
                  })}
                  className={`flex flex-col items-center flex-1 gap-1 rounded-lg pb-1 transition-all ${
                    d.count === 0
                      ? 'opacity-30 cursor-default'
                      : ativo
                      ? 'bg-input/60 ring-1 ring-subtle'
                      : 'hover:bg-input/30 cursor-pointer'
                  }`}
                  style={{ paddingTop: '4px' }}
                >
                  <span className="text-[11px] tabular-nums font-medium"
                    style={{ color: isNeg ? 'var(--color-danger)' : 'var(--color-success)' }}>
                    {d.count}
                  </span>
                  <div className="w-full px-1 bg-surface-2 rounded-t-sm flex items-end" style={{ height: '72px' }}>
                    <div
                      className="w-full rounded-t-sm transition-all duration-300"
                      style={{
                        height: `${h}%`,
                        minHeight: d.count > 0 ? '4px' : '0',
                        backgroundColor: barColor,
                        opacity: ativo ? 1 : 0.75,
                        boxShadow: ativo ? `0 0 8px ${barColor}` : 'none',
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-faint whitespace-nowrap">{d.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

    </div>
    <ProdutoDetalheDrawer produtoId={detalheId} onClose={() => setDetalheId(null)} />
    </>
  )
}
