'use client'

import { useState, useMemo } from 'react'
import { Calculator, Check, X, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { formatBRL, parseDecimalBR, formatCustoGrande, valorPorGrande, unidadeGrande } from '@/lib/format'
import { savePrecoVenda, savePrecoVendaLote } from '@/app/actions/painel'
import { usePermission } from '@/app/context/permissions-context'
import type { FichaFinanceira } from '@/app/actions/painel'

interface Props {
  fichas: FichaFinanceira[]
}

export function PainelPrecificacao({ fichas }: Props) {
  const [open, setOpen] = useState(false)
  const [margem, setMargem] = useState('40')
  const [modo, setModo] = useState<'margem' | 'markup'>('margem')
  const [calculado, setCalculado] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const { canWrite } = usePermission('painel')

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }

  const pct = parseDecimalBR(margem) || 0

  function calcPreco(custo: number): number {
    if (custo <= 0 || pct <= 0) return 0
    if (modo === 'margem') {
      if (pct >= 100) return 0
      return custo / (1 - pct / 100)
    }
    return custo * (1 + pct / 100)
  }

  // Exibição por kg/L para produtos fabricados (a % e o valor salvo continuam
  // por unidade-base; só a apresentação é escalada). Revenda: por unidade.
  const fmtCusto = (f: FichaFinanceira) =>
    f.rendimento_unidade ? formatCustoGrande(f.custo_total, f.rendimento_unidade) : `R$ ${formatBRL(f.custo_total)}`
  const fmtPreco = (f: FichaFinanceira, preco: number) =>
    f.rendimento_unidade
      ? `R$ ${formatBRL(valorPorGrande(preco, f.rendimento_unidade))}/${unidadeGrande(f.rendimento_unidade)}`
      : `R$ ${formatBRL(preco)}`

  // Produtos sem preço com custo > 0 (prioritários para precificação)
  const candidatos = useMemo(
    () => fichas.filter((f) => f.custo_total > 0 && f.preco_venda <= 0),
    [fichas]
  )

  async function aplicarLote(lista: FichaFinanceira[]) {
    if (!canWrite) return
    const precos = lista
      .map((f) => ({ id: f.produto_id, preco: calcPreco(f.custo_total) }))
      .filter((x) => x.preco > 0)
    if (precos.length === 0) return
    setSaving('all')
    // Upsert em lote: 1 chamada em vez de N (antes era um loop sequencial).
    const res = await savePrecoVendaLote(precos)
    setSaving(null)
    if (res.error) { showToast('error', res.error); return }
    const { salvos = 0, erros = 0 } = res.data ?? {}
    setSavedIds((prev) => {
      const next = new Set(prev)
      for (const { id } of precos) next.add(id)
      return next
    })
    if (erros > 0) showToast('error', `${salvos} aplicados · ${erros} ignorados`)
    else showToast('success', `${salvos} preços aplicados`)
  }

  async function aplicarUm(id: string, preco: number) {
    if (!canWrite || preco <= 0) return
    setSaving(id)
    const res = await savePrecoVenda(id, preco)
    setSaving(null)
    if (res.error) showToast('error', res.error)
    else {
      setSavedIds((prev) => new Set(prev).add(id))
      showToast('success', 'Preço aplicado')
    }
  }

  const listaParaMostrar = calculado
    ? candidatos.filter((f) => calcPreco(f.custo_total) > 0)
    : []

  const modoLabel = modo === 'margem' ? 'margem' : 'markup'

  return (
    <section className="card-surface border border-subtle rounded-2xl overflow-hidden">
      {/* Header colapsável */}
      <button
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-canvas/30 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent-primary/10 flex items-center justify-center shrink-0">
            <Calculator size={14} className="text-accent-primary" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-primary leading-tight">Precificadora Inteligente</p>
            <p className="text-[11px] text-faint">
              {candidatos.length > 0
                ? `${candidatos.length} produto${candidatos.length !== 1 ? 's' : ''} sem preço — defina a margem alvo`
                : 'Todos os produtos estão precificados'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {candidatos.length > 0 && (
            <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2 py-0.5">
              {candidatos.length}
            </span>
          )}
          {open ? <ChevronUp size={14} className="text-faint" /> : <ChevronDown size={14} className="text-faint" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-subtle">
          {/* Painel de configuração */}
          <div className="px-5 py-4 bg-canvas/30 flex flex-wrap items-end gap-4 border-b border-subtle">
            {/* Toggle modo */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Modo</label>
              <div className="flex rounded-lg overflow-hidden border border-subtle">
                <button onClick={() => { setModo('margem'); setCalculado(false) }}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    modo === 'margem' ? 'bg-accent-primary text-white' : 'text-secondary hover:text-primary'
                  }`}>
                  Margem %
                </button>
                <button onClick={() => { setModo('markup'); setCalculado(false) }}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    modo === 'markup' ? 'bg-accent-primary text-white' : 'text-secondary hover:text-primary'
                  }`}>
                  Markup %
                </button>
              </div>
            </div>

            {/* Input de percentual */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-secondary">
                {modo === 'margem' ? 'Margem alvo' : 'Markup alvo'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text" inputMode="decimal"
                  value={margem}
                  onChange={(e) => { setMargem(e.target.value); setCalculado(false) }}
                  className="input-field text-sm py-1.5 px-3 w-20 text-right tabular-nums"
                />
                <span className="text-sm text-secondary">%</span>
              </div>
            </div>

            {/* Botão calcular */}
            <button
              onClick={() => setCalculado(true)}
              disabled={pct <= 0 || candidatos.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-primary/10 border border-accent-primary/30 text-accent-primary text-sm font-medium hover:bg-accent-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Sparkles size={14} />
              Calcular Sugestões
            </button>

            {calculado && canWrite && listaParaMostrar.length > 0 && (
              <button
                onClick={() => aplicarLote(listaParaMostrar)}
                disabled={saving === 'all'}
                className="btn-primary px-4 py-2 text-sm ml-auto disabled:opacity-50"
              >
                {saving === 'all' ? 'Aplicando…' : `Aplicar em Lote (${listaParaMostrar.length})`}
              </button>
            )}
          </div>

          {/* Preview da fórmula */}
          {calculado && pct > 0 && candidatos.length > 0 && (
            <div className="px-5 py-3 bg-accent-primary/5 border-b border-subtle">
              <p className="text-[12px] text-secondary">
                Com {modoLabel} alvo de{' '}
                <span className="text-accent-primary font-semibold">{pct}%</span>, o{' '}
                <span className="text-primary font-medium">{candidatos[0].produto_nome}</span>{' '}
                (custo {fmtCusto(candidatos[0])}) deveria ser vendido a{' '}
                <span className="text-success font-semibold">
                  {fmtPreco(candidatos[0], calcPreco(candidatos[0].custo_total))}
                </span>
              </p>
            </div>
          )}

          {/* Toast */}
          {toast && (
            <div className={`mx-5 mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm border ${
              toast.type === 'success'
                ? 'bg-success/10 border-success/20 text-success'
                : 'bg-danger/10 border-danger/20 text-danger'
            }`}>
              {toast.type === 'success' ? <Check size={13} /> : <X size={13} />}
              {toast.msg}
            </div>
          )}

          {/* Lista de sugestões */}
          {calculado && listaParaMostrar.length > 0 && (
            <div className="divide-y divide-subtle">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-2 bg-canvas text-[10px] font-semibold uppercase tracking-wider text-faint">
                <span>Produto</span>
                <span className="w-24 text-right">Custo</span>
                <span className="w-28 text-right">Preço Sugerido</span>
                {canWrite && <span className="w-16 text-right">Ação</span>}
              </div>
              {listaParaMostrar.slice(0, 60).map((f) => {
                const sugerido = calcPreco(f.custo_total)
                const jaFeito = savedIds.has(f.produto_id)
                return (
                  <div key={f.produto_id}
                    className={`grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-5 py-2.5 hover:bg-canvas/40 transition-colors ${jaFeito ? 'opacity-50' : ''}`}>
                    <span className="text-sm text-primary truncate" title={f.produto_nome}>
                      {f.produto_nome}
                    </span>
                    <span className="w-24 text-right text-sm tabular-nums text-secondary">
                      {fmtCusto(f)}
                    </span>
                    <span className="w-28 text-right text-sm tabular-nums font-semibold text-accent-primary">
                      {sugerido > 0 ? fmtPreco(f, sugerido) : '—'}
                    </span>
                    {canWrite && (
                      <div className="w-16 flex justify-end">
                        {jaFeito ? (
                          <span className="text-[11px] text-success flex items-center gap-1">
                            <Check size={11} />Aplicado
                          </span>
                        ) : (
                          <button
                            onClick={() => aplicarUm(f.produto_id, sugerido)}
                            disabled={saving === f.produto_id || sugerido <= 0}
                            className="text-[11px] font-medium text-accent-primary hover:underline disabled:opacity-40"
                          >
                            {saving === f.produto_id ? '…' : 'Usar'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
              {listaParaMostrar.length > 60 && (
                <p className="px-5 py-2.5 text-[11px] text-faint text-center border-t border-subtle">
                  Mostrando 60 de {listaParaMostrar.length} produtos sem preço
                </p>
              )}
            </div>
          )}

          {calculado && listaParaMostrar.length === 0 && (
            <div className="px-5 py-8 text-center">
              <p className="text-faint text-sm">
                {candidatos.length === 0
                  ? '✓ Todos os produtos já têm preço cadastrado'
                  : pct <= 0
                  ? 'Defina um percentual de margem/markup válido'
                  : 'Nenhum produto para precificar com os filtros atuais'}
              </p>
            </div>
          )}

          {!calculado && candidatos.length > 0 && (
            <div className="px-5 py-8 text-center">
              <p className="text-faint text-sm">
                Configure a margem alvo acima e clique em <span className="text-accent-primary">Calcular Sugestões</span>
              </p>
            </div>
          )}

          {candidatos.length === 0 && (
            <div className="px-5 py-6 text-center">
              <p className="text-success text-sm font-medium">✓ Todos os produtos com custo já estão precificados</p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
