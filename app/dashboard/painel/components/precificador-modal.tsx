'use client'

import { useState, useMemo } from 'react'
import { X, Calculator, CheckCircle, Loader2, ArrowRight } from 'lucide-react'
import { aplicarPrecoAction } from '@/app/actions/painel'
import { parseDecimalBR, formatBRL } from '@/lib/format'
import type { ProdutoRentabilidade } from '../types'

const INPUT =
  'w-full bg-input border border-subtle rounded-lg px-4 py-2.5 text-sm text-primary placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent-primary/40 focus:border-accent-primary transition-colors'
const LABEL = 'block text-xs font-medium uppercase tracking-wider text-secondary mb-1.5'

type Metodo = 'margem' | 'markup'

interface Props {
  produtos: ProdutoRentabilidade[]
  onClose: () => void
  onSuccess: (produtoId: string, novoPreco: number) => void
}

export function PrecificadorModal({ produtos, onClose, onSuccess }: Props) {
  const [produtoId,  setProdutoId]  = useState(produtos[0]?.id ?? '')
  const [metodo,     setMetodo]     = useState<Metodo>('margem')
  const [pctInput,   setPctInput]   = useState('40')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [aplicado,   setAplicado]   = useState(false)

  const produto = produtos.find((p) => p.id === produtoId) ?? produtos[0]

  const precoSugerido = useMemo(() => {
    if (!produto || produto.custo <= 0) return null
    const pct = parseDecimalBR(pctInput)
    if (Number.isNaN(pct) || pct <= 0) return null
    if (metodo === 'margem') {
      if (pct >= 100) return null
      return produto.custo / (1 - pct / 100)
    }
    return produto.custo * (1 + pct / 100)
  }, [produto, metodo, pctInput])

  const margemSugerida = useMemo(() => {
    if (!produto || !precoSugerido || precoSugerido <= 0) return null
    return ((precoSugerido - produto.custo) / precoSugerido) * 100
  }, [produto, precoSugerido])

  async function handleAplicar() {
    if (!produto || !precoSugerido) return
    setError(null)
    setLoading(true)
    const result = await aplicarPrecoAction(produto.id, precoSugerido)
    setLoading(false)
    if (result.error) { setError(result.error); return }
    setAplicado(true)
    onSuccess(produto.id, precoSugerido)
    setTimeout(onClose, 1200)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-[500px] bg-surface border border-subtle rounded-xl shadow-2xl shadow-black/40 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent-primary/12 flex items-center justify-center">
              <Calculator size={18} className="text-accent-primary" />
            </div>
            <div>
              <p className="text-base font-semibold text-primary">Precificador</p>
              <p className="text-xs text-secondary mt-0.5">Calcule o preço ideal por margem ou markup</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-secondary hover:text-accent-primary hover:bg-accent-tint transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">

          {/* Select produto */}
          <div>
            <label className={LABEL}>Produto</label>
            <select
              value={produtoId}
              onChange={(e) => { setProdutoId(e.target.value); setAplicado(false) }}
              className={INPUT}
            >
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>

          {/* Custo atual (read-only) */}
          {produto && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className={LABEL}>Custo de Produção</p>
                <div className="px-4 py-2.5 rounded-lg bg-canvas border border-subtle text-sm font-semibold text-ink-soft tabular-nums">
                  {produto.custo > 0 ? `R$ ${formatBRL(produto.custo)}` : '—'}
                </div>
              </div>
              <div>
                <p className={LABEL}>Preço Atual</p>
                <div className="px-4 py-2.5 rounded-lg bg-canvas border border-subtle text-sm font-semibold text-ink-soft tabular-nums">
                  {produto.preco > 0 ? `R$ ${formatBRL(produto.preco)}` : '—'}
                </div>
              </div>
            </div>
          )}

          {/* Toggle Método */}
          <div>
            <p className={LABEL}>Método de cálculo</p>
            <div className="inline-flex bg-input p-1 rounded-lg gap-1 w-full">
              {([
                { key: 'margem', label: 'Margem sobre venda' },
                { key: 'markup', label: 'Markup sobre custo' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { setMetodo(key); setAplicado(false) }}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    metodo === key
                      ? 'bg-accent-primary text-accent-ink font-semibold shadow-sm'
                      : 'text-secondary hover:text-ink-soft'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-faint mt-1.5">
              {metodo === 'margem'
                ? 'Fórmula: preço = custo ÷ (1 − margem%)'
                : 'Fórmula: preço = custo × (1 + markup%)'}
            </p>
          </div>

          {/* Input % */}
          <div>
            <label className={LABEL}>
              {metodo === 'margem' ? 'Margem desejada (%)' : 'Markup desejado (%)'}
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={pctInput}
                onChange={(e) => { setPctInput(e.target.value); setAplicado(false) }}
                className={`${INPUT} pr-8`}
                placeholder="40"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-faint">%</span>
            </div>
          </div>

          {/* Resultado */}
          {precoSugerido !== null && produto ? (
            <div className="rounded-xl bg-canvas border border-accent-primary/20 p-4 space-y-3">
              {/* Preço sugerido em destaque */}
              <div className="flex items-baseline gap-2">
                <span className="text-xs uppercase tracking-wider text-secondary font-semibold">Preço sugerido</span>
              </div>
              <p className="font-playfair text-3xl font-bold text-primary tabular-nums leading-none">
                R$ {formatBRL(precoSugerido)}
              </p>

              {/* Comparação atual → sugerido */}
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <span className="text-secondary tabular-nums">
                  Atual: R$ {produto.preco > 0 ? formatBRL(produto.preco) : '—'}
                </span>
                <ArrowRight size={13} className="text-accent-primary/50 shrink-0" />
                <span className="font-semibold text-primary tabular-nums">
                  Sugerido: R$ {formatBRL(precoSugerido)}
                </span>
              </div>

              {/* Margem resultante */}
              {margemSugerida !== null && (
                <div className="flex items-center gap-3 pt-1 border-t border-subtle">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-secondary">Margem resultante</p>
                    <p className={`text-sm font-bold tabular-nums ${margemSugerida >= 40 ? 'text-success' : margemSugerida >= 20 ? 'text-amber-400' : 'text-danger'}`}>
                      {margemSugerida.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-secondary">Markup resultante</p>
                    <p className="text-sm font-bold text-ink-soft tabular-nums">
                      {(((precoSugerido - produto.custo) / produto.custo) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl bg-canvas border border-subtle p-4 text-center">
              <p className="text-sm text-faint">
                {produto?.custo <= 0
                  ? 'Este produto não tem custo cadastrado.'
                  : 'Informe uma porcentagem válida para ver o preço.'}
              </p>
            </div>
          )}

          {error && (
            <p className="text-sm text-danger bg-danger-tint rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-subtle">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg bg-transparent border border-subtle text-ink-soft hover:bg-input hover:text-primary text-sm font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleAplicar}
            disabled={!precoSugerido || loading || aplicado}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent-primary hover:bg-accent-hover text-accent-ink text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {aplicado
              ? <><CheckCircle size={15} /> Aplicado!</>
              : loading
              ? <><Loader2 size={15} className="animate-spin" /> Salvando...</>
              : 'Aplicar Preço'}
          </button>
        </div>
      </div>
    </div>
  )
}
