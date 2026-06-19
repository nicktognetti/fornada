'use client'

import { useState, useMemo } from 'react'
import { Play, TrendingUp, TrendingDown, Minus, RotateCcw } from 'lucide-react'
import { parseDecimalBR, formatBRL } from '@/lib/format'
import type { ProdutoRentabilidade, SimulacaoResultado } from '@/app/dashboard/painel/types'

const INPUT =
  'w-full bg-input border border-subtle rounded-lg px-4 py-2.5 text-sm text-primary placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent-primary/40 focus:border-accent-primary transition-colors'
const LABEL = 'block text-xs font-medium uppercase tracking-wider text-secondary mb-1.5'

interface Props {
  produtos: ProdutoRentabilidade[]
}

export function SimuladorClient({ produtos }: Props) {
  const [pctInput,    setPctInput]    = useState('10')
  const [direcao,     setDirecao]     = useState<'aumento' | 'reducao'>('aumento')
  const [produtoFiltro, setProdutoFiltro] = useState('todos')
  const [resultados,  setResultados]  = useState<SimulacaoResultado[] | null>(null)

  const produtosAlvo = useMemo(
    () => produtoFiltro === 'todos' ? produtos : produtos.filter((p) => p.id === produtoFiltro),
    [produtos, produtoFiltro]
  )

  function simular() {
    const pct = parseDecimalBR(pctInput)
    if (Number.isNaN(pct) || pct <= 0) return

    const fator = direcao === 'aumento' ? 1 + pct / 100 : 1 - pct / 100

    const res: SimulacaoResultado[] = produtosAlvo.map((p) => {
      const novoPreco   = p.preco * fator
      const novaMargem  = ((novoPreco - p.custo) / novoPreco) * 100
      const variacao    = novaMargem - p.margem
      return {
        produto:     p.nome,
        precoAtual:  p.preco,
        novoPreco,
        margemAtual: p.margem,
        novaMargem,
        variacao,
      }
    })

    setResultados(res)
  }

  const impactoMedio = useMemo(() => {
    if (!resultados || resultados.length === 0) return null
    const antes = resultados.reduce((s, r) => s + r.margemAtual, 0) / resultados.length
    const depois = resultados.reduce((s, r) => s + r.novaMargem, 0) / resultados.length
    return { antes, depois, delta: depois - antes }
  }, [resultados])

  return (
    <div className="space-y-6">
      {/* Controles */}
      <div className="card-surface px-6 py-5 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* % de variação */}
          <div>
            <label className={LABEL}>Variação de preço (%)</label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={pctInput}
                onChange={(e) => { setPctInput(e.target.value); setResultados(null) }}
                className={`${INPUT} pr-8`}
                placeholder="10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-faint">%</span>
            </div>
          </div>

          {/* Direção */}
          <div>
            <p className={LABEL}>Direção</p>
            <div className="flex bg-input p-1 rounded-lg gap-1 h-[42px]">
              {([
                { key: 'aumento', label: '▲ Aumento' },
                { key: 'reducao', label: '▼ Redução' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { setDirecao(key); setResultados(null) }}
                  className={`flex-1 rounded-md text-sm font-medium transition-all ${
                    direcao === key
                      ? 'bg-accent-primary text-accent-ink font-semibold shadow-sm'
                      : 'text-secondary hover:text-ink-soft'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Produto */}
          <div>
            <label className={LABEL}>Produto</label>
            <select
              value={produtoFiltro}
              onChange={(e) => { setProdutoFiltro(e.target.value); setResultados(null) }}
              className={INPUT}
            >
              <option value="todos">Todos os produtos</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Botão Simular */}
        <div className="flex items-center gap-3">
          <button
            onClick={simular}
            disabled={produtos.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent-primary hover:bg-accent-hover text-accent-ink text-sm font-semibold shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play size={14} />
            Simular
          </button>
          {resultados && (
            <button
              onClick={() => setResultados(null)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-subtle text-secondary hover:text-ink-soft hover:bg-input text-sm font-medium transition-colors"
            >
              <RotateCcw size={13} />
              Limpar
            </button>
          )}
          {produtos.length === 0 && (
            <p className="text-sm text-faint">Nenhum produto com custo e preço disponível.</p>
          )}
        </div>
      </div>

      {/* Resultados */}
      {resultados && (
        <>
          {/* Card impacto médio */}
          {impactoMedio && (
            <div className="card-surface px-6 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary mb-3">
                Impacto na Margem Média
              </p>
              <div className="flex items-center gap-6 flex-wrap">
                <div>
                  <p className="text-xs text-faint mb-0.5">Antes</p>
                  <p className="font-playfair text-2xl font-bold tabular-nums text-ink-soft">
                    {impactoMedio.antes.toFixed(1)}%
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {impactoMedio.delta > 0 ? (
                    <TrendingUp size={20} className="text-success" />
                  ) : impactoMedio.delta < 0 ? (
                    <TrendingDown size={20} className="text-danger" />
                  ) : (
                    <Minus size={20} className="text-faint" />
                  )}
                  <span className={`text-lg font-bold tabular-nums ${
                    impactoMedio.delta > 0 ? 'text-success' :
                    impactoMedio.delta < 0 ? 'text-danger' : 'text-faint'
                  }`}>
                    {impactoMedio.delta > 0 ? '+' : ''}{impactoMedio.delta.toFixed(1)} pp
                  </span>
                </div>
                <div>
                  <p className="text-xs text-faint mb-0.5">Depois</p>
                  <p className={`font-playfair text-2xl font-bold tabular-nums ${
                    impactoMedio.depois >= 40 ? 'text-success' :
                    impactoMedio.depois >= 20 ? 'text-amber-400' : 'text-danger'
                  }`}>
                    {impactoMedio.depois.toFixed(1)}%
                  </p>
                </div>
                <p className="text-xs text-secondary ml-auto">
                  {resultados.length} produto{resultados.length !== 1 ? 's' : ''} simulado{resultados.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          )}

          {/* Tabela ANTES vs DEPOIS */}
          <div className="card-surface overflow-hidden">
            <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-5 py-3 border-b border-subtle bg-canvas">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Produto</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary w-24 text-right">Preço Atual</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary w-24 text-right">Novo Preço</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary w-20 text-right">Margem Atual</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary w-20 text-right">Nova Margem</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary w-20 text-right">Variação</span>
            </div>

            <div className="divide-y divide-subtle">
              {resultados.map((r, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-3 md:gap-4 px-5 py-4 hover:bg-input/50 transition-colors"
                >
                  {/* Produto */}
                  <p className="font-playfair text-[16px] font-semibold text-primary leading-tight truncate">
                    {r.produto}
                  </p>

                  {/* Preço Atual */}
                  <div className="flex items-center justify-between md:block md:w-24">
                    <span className="text-xs text-secondary md:hidden">Preço Atual</span>
                    <span className="text-sm tabular-nums text-secondary text-right">
                      R$ {formatBRL(r.precoAtual)}
                    </span>
                  </div>

                  {/* Novo Preço */}
                  <div className="flex items-center justify-between md:block md:w-24">
                    <span className="text-xs text-secondary md:hidden">Novo Preço</span>
                    <span className="text-sm tabular-nums font-semibold text-ink-soft text-right">
                      R$ {formatBRL(r.novoPreco)}
                    </span>
                  </div>

                  {/* Margem Atual */}
                  <div className="flex items-center justify-between md:block md:w-20">
                    <span className="text-xs text-secondary md:hidden">Margem Atual</span>
                    <span className="text-sm tabular-nums text-secondary text-right block">
                      {r.margemAtual.toFixed(1)}%
                    </span>
                  </div>

                  {/* Nova Margem */}
                  <div className="flex items-center justify-between md:block md:w-20">
                    <span className="text-xs text-secondary md:hidden">Nova Margem</span>
                    <span className={`text-sm font-bold tabular-nums text-right block ${
                      r.novaMargem >= 40 ? 'text-success' :
                      r.novaMargem >= 20 ? 'text-amber-400' : 'text-danger'
                    }`}>
                      {r.novaMargem.toFixed(1)}%
                    </span>
                  </div>

                  {/* Variação */}
                  <div className="flex items-center justify-between md:justify-end md:w-20">
                    <span className="text-xs text-secondary md:hidden">Variação</span>
                    <span className={`text-sm font-semibold tabular-nums flex items-center gap-1 ${
                      r.variacao > 0 ? 'text-success' :
                      r.variacao < 0 ? 'text-danger' : 'text-faint'
                    }`}>
                      {r.variacao > 0 ? <TrendingUp size={12} /> : r.variacao < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                      {r.variacao > 0 ? '+' : ''}{r.variacao.toFixed(1)} pp
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Estado vazio inicial */}
      {!resultados && produtos.length > 0 && (
        <div className="card-surface p-10 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-accent-primary/10 flex items-center justify-center">
            <Play size={20} className="text-accent-primary/60" />
          </div>
          <p className="text-primary font-playfair text-lg font-semibold">Pronto para simular</p>
          <p className="text-secondary text-sm max-w-xs">
            Configure a variação e clique em <strong className="text-ink-soft">Simular</strong> para ver
            o impacto nos preços e margens antes de qualquer alteração real.
          </p>
        </div>
      )}
    </div>
  )
}
