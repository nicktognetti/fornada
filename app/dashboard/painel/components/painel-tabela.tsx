'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, ListPlus, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { formatBRL, parseDecimalBR, formatCustoGrande, fatorGrande, unidadeGrande } from '@/lib/format'
import { savePrecoVenda, savePrecoVendaLote } from '@/app/actions/painel'
import { usePermission } from '@/app/context/permissions-context'
import { ProdutoDetalheDrawer } from '@/app/components/produto-detalhe-drawer'
import type { ProdutoFinanceiro } from '@/app/actions/painel'
import type { AlertaFiltro, ChartFilter } from './painel-client'

// ── Constantes ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25

const TIPO_BADGE: Record<string, { label: string; cls: string }> = {
  produzido: { label: 'Fabricado', cls: 'bg-accent-primary/15 text-accent-primary border-accent-primary/20' },
  revenda:   { label: 'Revenda',   cls: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
}

type SortCol = 'custo_total' | 'preco_venda' | 'margem_percentual' | 'markup_percentual' | null
type SortDir = 'asc' | 'desc'

// ── Badge de status ───────────────────────────────────────────────────────────

function StatusBadge({ f }: { f: ProdutoFinanceiro }) {
  if (f.custo_total <= 0 && f.produto_tipo === 'revenda') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-danger/10 text-danger border border-danger/20">
        ⚠ Sem custo
      </span>
    )
  }
  if (f.preco_venda > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-success/10 text-success border border-success/20">
        💲 Precificado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
      ⏳ Aguardando
    </span>
  )
}

// ── Modal lote ────────────────────────────────────────────────────────────────

function LoteModal({ fichas, onClose }: { fichas: ProdutoFinanceiro[]; onClose: () => void }) {
  const [preco, setPreco] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)
  const router = useRouter()

  function toggleAll() {
    setSelected(selected.size === fichas.length ? new Set() : new Set(fichas.map((f) => f.produto_id)))
  }

  async function handleSalvar() {
    const val = parseDecimalBR(preco)
    if (!val || val <= 0 || selected.size === 0) return
    setSaving(true)
    // Preço digitado é por kg/L; converte para unidade-base por produto (÷1000 se g/ml).
    const unidadePorId = new Map(fichas.map((f) => [f.produto_id, f.rendimento_unidade]))
    const items = Array.from(selected).map((id) => ({ id, preco: val / fatorGrande(unidadePorId.get(id) ?? null) }))
    const res = await savePrecoVendaLote(items)
    setSaving(false)
    if (res.error) {
      setResultado(`Erro: ${res.error}`)
    } else {
      const { salvos = 0, erros = 0 } = res.data ?? {}
      setResultado(`${salvos} preço${salvos !== 1 ? 's' : ''} salvos${erros > 0 ? ` · ${erros} ignorados` : ''}`)
      router.refresh()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <div className="relative w-full max-w-lg bg-surface border border-subtle rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-subtle">
          <div className="flex items-center gap-2">
            <ListPlus size={16} className="text-accent-primary" />
            <h2 className="text-base font-semibold text-primary">Adicionar Preço em Lote</h2>
          </div>
          <button onClick={onClose} disabled={saving} className="text-faint hover:text-secondary p-1"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 border-b border-subtle">
          <label className="field-label mb-2">Preço de venda para os selecionados (por kg · fabricados por peso)</label>
          <div className="flex items-center gap-3">
            <span className="text-secondary text-sm shrink-0">R$</span>
            <input type="text" inputMode="decimal" value={preco}
              onChange={(e) => setPreco(e.target.value)}
              placeholder="0,00" className="input-field text-sm py-2 w-32 text-right tabular-nums" disabled={saving} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-2.5 border-b border-subtle flex items-center gap-3 sticky top-0 bg-surface">
            <input type="checkbox" checked={selected.size === fichas.length && fichas.length > 0}
              onChange={toggleAll} className="accent-[var(--color-accent-primary)]" />
            <span className="text-xs text-secondary font-medium">
              {selected.size === 0 ? 'Selecionar todos' : `${selected.size} selecionados`}
            </span>
          </div>
          {fichas.map((f) => (
            <label key={f.produto_id}
              className="flex items-center gap-3 px-5 py-2.5 hover:bg-canvas/40 cursor-pointer border-b border-subtle/40 last:border-0">
              <input type="checkbox" checked={selected.has(f.produto_id)}
                onChange={(e) => {
                  const next = new Set(selected)
                  if (e.target.checked) next.add(f.produto_id)
                  else next.delete(f.produto_id)
                  setSelected(next)
                }}
                className="accent-[var(--color-accent-primary)] shrink-0" />
              <span className="flex-1 text-sm text-primary truncate">{f.produto_nome}</span>
              <span className="text-xs tabular-nums text-secondary shrink-0">{f.rendimento_unidade ? formatCustoGrande(f.custo_total, f.rendimento_unidade) : `R$ ${formatBRL(f.custo_total)}`}</span>
            </label>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-subtle">
          {resultado && (
            <p className="text-success text-sm mb-3 flex items-center gap-2"><Check size={13} />{resultado}</p>
          )}
          <div className="flex justify-end gap-3">
            <button onClick={onClose} disabled={saving}
              className="px-4 py-2 rounded-xl text-sm text-secondary hover:text-primary hover:bg-input transition-colors">
              {resultado ? 'Fechar' : 'Cancelar'}
            </button>
            {!resultado && (
              <button onClick={handleSalvar} disabled={saving || selected.size === 0 || !preco}
                className="btn-primary px-5 py-2 disabled:opacity-50">
                {saving ? 'Salvando…' : `Salvar para ${selected.size}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Input inline de preço ─────────────────────────────────────────────────────

function PrecoCell({ f, canWrite }: { f: ProdutoFinanceiro; canWrite: boolean }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState(false)
  // Estado local para refletir o novo preço otimisticamente até o router.refresh() chegar
  const [localPreco, setLocalPreco] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const precoExibido = localPreco ?? f.preco_venda
  const comPreco = precoExibido > 0
  // Fabricado por peso/volume: exibe/edita por kg/L (×1000); salva por unidade-base (÷1000).
  const fator = fatorGrande(f.rendimento_unidade)
  const sufixo = f.rendimento_unidade ? `/${unidadeGrande(f.rendimento_unidade)}` : ''

  function startEdit() {
    if (!canWrite || saving) return
    setValue(comPreco ? (precoExibido * fator).toFixed(2) : '')
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const save = useCallback(async () => {
    const valGrande = parseDecimalBR(value)
    if (!valGrande || valGrande <= 0) { setEditing(false); return }
    const valBase = valGrande / fator
    setSaving(true)
    const res = await savePrecoVenda(f.produto_id, valBase)
    setSaving(false)
    if (!res.error) {
      setLocalPreco(valBase)
      setFlash(true)
      setTimeout(() => setFlash(false), 1200)
      router.refresh()
    }
    setEditing(false)
  }, [value, f, fator, router])

  if (!canWrite) {
    return (
      <span className="w-28 text-right text-sm tabular-nums text-primary">
        {comPreco ? `R$ ${formatBRL(precoExibido * fator)}${sufixo}` : <span className="text-faint">—</span>}
      </span>
    )
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 w-28 justify-end" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); void save() }
            if (e.key === 'Escape') setEditing(false)
          }}
          placeholder="0,00"
          className="input-field text-xs py-1 px-2 w-24 text-right tabular-nums"
          disabled={saving}
          autoFocus
        />
      </div>
    )
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); startEdit() }}
      title={comPreco ? 'Clique para editar' : 'Clique para adicionar preço'}
      className={`w-28 text-right transition-all group ${flash ? 'text-success' : ''}`}
    >
      {flash ? (
        <span className="text-success text-xs flex items-center justify-end gap-1"><Check size={11} />Salvo</span>
      ) : comPreco ? (
        <span className="text-sm tabular-nums text-primary group-hover:text-accent-primary group-hover:underline group-hover:underline-offset-2 group-hover:decoration-accent-primary/50 transition-colors">
          R$ {formatBRL(precoExibido * fator)}{sufixo}
        </span>
      ) : (
        <span className="flex justify-end">
          <span className="bg-input/60 border border-dashed border-subtle/60 rounded px-2 py-0.5 text-[11px] text-secondary/60 group-hover:border-accent-primary/50 group-hover:text-accent-primary group-hover:bg-accent-primary/5 transition-all">
            R$ 0,00
          </span>
        </span>
      )}
    </button>
  )
}

// ── Cabeçalho ordenável ───────────────────────────────────────────────────────

function SortHeader({
  col, label, sortCol, sortDir, onSort, className,
}: {
  col: SortCol
  label: string
  sortCol: SortCol
  sortDir: SortDir
  onSort: (col: SortCol) => void
  className?: string
}) {
  const active = sortCol === col
  return (
    <button
      onClick={() => onSort(col)}
      className={`flex items-center gap-1 hover:text-primary transition-colors group ${
        active ? 'text-primary' : 'text-faint'
      } ${className ?? ''}`}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      <span className={`transition-opacity ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}>
        {active && sortDir === 'asc' ? (
          <ChevronUp size={10} />
        ) : active && sortDir === 'desc' ? (
          <ChevronDown size={10} />
        ) : (
          <ChevronsUpDown size={10} />
        )}
      </span>
    </button>
  )
}

// ── PainelTabela ──────────────────────────────────────────────────────────────

interface Props {
  fichas: ProdutoFinanceiro[]
  alertaFiltro: AlertaFiltro
  chartFilter: ChartFilter
  onClearChartFilter: () => void
}

function getFaixa(custo: number): 'alta' | 'media' | 'baixa' {
  if (custo > 5) return 'alta'
  if (custo > 1) return 'media'
  return 'baixa'
}

export function PainelTabela({ fichas, alertaFiltro, chartFilter, onClearChartFilter }: Props) {
  const [search, setSearch] = useState('')
  const [loteOpen, setLoteOpen] = useState(false)
  const [sortCol, setSortCol] = useState<SortCol>('margem_percentual')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(0)
  const [detalheId, setDetalheId] = useState<string | null>(null)
  const { canWrite } = usePermission('painel')

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
    setPage(0)
  }

  // Filtros
  let filtered = fichas.filter((f) => {
    const matchSearch = !search || f.produto_nome.toLowerCase().includes(search.toLowerCase())
    const matchAlerta = !alertaFiltro
      || (f.preco_venda <= 0 && f.custo_total > 0 && getFaixa(f.custo_total) === alertaFiltro)
    const matchChart = !chartFilter
      || (chartFilter.tipo === 'produto' && f.produto_id === chartFilter.id)
      || (chartFilter.tipo === 'faixa_margem'
          && f.preco_venda > 0
          && f.margem_percentual >= chartFilter.min
          && f.margem_percentual < chartFilter.max)
    return matchSearch && matchAlerta && matchChart
  })

  // Ordenação
  if (sortCol) {
    const key = sortCol
    filtered = [...filtered].sort((a, b) => {
      const va = a[key] as number
      const vb = b[key] as number
      return sortDir === 'asc' ? va - vb : vb - va
    })
  }

  const total = filtered.length
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const alertaLabel: Record<string, string> = {
    alta: 'custo > R$ 5 sem preço',
    media: 'custo R$ 1–5 sem preço',
    baixa: 'custo < R$ 1 sem preço',
  }

  return (
    <section>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-secondary">Produtos</h2>
          {alertaFiltro && (
            <span className="text-[10px] bg-input border border-subtle text-secondary rounded-full px-2 py-0.5">
              {alertaLabel[alertaFiltro]}
            </span>
          )}
          {chartFilter && (
            <span className="flex items-center gap-1 text-[10px] bg-accent-primary/10 border border-accent-primary/25 text-accent-primary rounded-full pl-2 pr-1 py-0.5">
              {chartFilter.label}
              <button
                onClick={() => { onClearChartFilter(); setPage(0) }}
                className="ml-0.5 hover:text-danger transition-colors"
                title="Limpar filtro"
              >
                <X size={10} />
              </button>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Buscar produto…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="input-field text-sm py-1.5 w-44"
          />
          {canWrite && (
            <button
              onClick={() => setLoteOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-subtle text-secondary hover:text-primary hover:bg-input/40 transition-colors shrink-0"
            >
              <ListPlus size={13} />
              Lote
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-surface border border-subtle overflow-hidden">
        {/* Cabeçalho */}
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 px-5 py-2.5 border-b border-subtle bg-canvas">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-faint">Produto / Loja</span>
          <SortHeader col="custo_total"       label="Custo"   sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="w-24 justify-end" />
          <span className="w-28 text-[10px] font-semibold uppercase tracking-wider text-faint text-right">Preço Venda</span>
          <SortHeader col="margem_percentual" label="Margem"  sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="w-20 justify-end" />
          <SortHeader col="markup_percentual" label="Markup"  sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="w-20 justify-end" />
          <span className="w-28 text-[10px] font-semibold uppercase tracking-wider text-faint text-right">Status</span>
        </div>

        {/* Linhas */}
        {paged.length === 0 ? (
          <div className="py-10 text-center text-faint text-sm">
            {search || alertaFiltro ? 'Nenhum produto encontrado' : 'Nenhum produto ativo'}
          </div>
        ) : (
          paged.map((f) => {
            const badge = TIPO_BADGE[f.produto_tipo]
            const comPreco = f.preco_venda > 0

            return (
              <div
                key={f.produto_id}
                onClick={() => setDetalheId(f.produto_id)}
                title="Ver detalhe do produto"
                className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 items-center px-5 py-3 border-b border-subtle last:border-0 hover:bg-canvas/40 transition-colors cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-primary truncate" title={f.produto_nome}>
                      {f.produto_nome}
                    </p>
                    {badge && (
                      <span className={`inline-flex shrink-0 items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide border ${badge.cls}`}>
                        {badge.label}
                      </span>
                    )}
                  </div>
                  {f.unidade_nome && (
                    <p className="text-[11px] text-faint">{f.unidade_nome}</p>
                  )}
                </div>

                <span className="w-24 text-right text-sm tabular-nums text-secondary">
                  {f.custo_total > 0 ? (f.rendimento_unidade ? formatCustoGrande(f.custo_total, f.rendimento_unidade) : `R$ ${formatBRL(f.custo_total)}`) : <span className="text-faint">—</span>}
                </span>

                <PrecoCell f={f} canWrite={canWrite} />

                <span className={`w-20 text-right text-sm tabular-nums ${
                  !comPreco ? 'text-faint' :
                  f.margem_percentual < 0 ? 'text-danger font-semibold' :
                  f.margem_percentual < 20 ? 'text-amber-400' : 'text-success'
                }`}>
                  {comPreco ? `${f.margem_percentual.toFixed(1)}%` : '—'}
                </span>

                <span className={`w-20 text-right text-sm tabular-nums ${comPreco ? 'text-secondary' : 'text-faint'}`}>
                  {comPreco ? `${f.markup_percentual.toFixed(1)}%` : '—'}
                </span>

                <div className="w-28 flex justify-end">
                  <StatusBadge f={f} />
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Footer / paginação */}
      <div className="flex items-center justify-between mt-2 px-1">
        <p className="text-[11px] text-faint">
          {total === 0
            ? 'Nenhum resultado'
            : `Mostrando ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} de ${total} produto${total !== 1 ? 's' : ''}`}
        </p>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
              className="px-2 py-1 rounded text-xs text-secondary hover:text-primary hover:bg-input disabled:opacity-30 transition-colors">
              ‹
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let num: number
              if (totalPages <= 7) {
                num = i
              } else if (page < 3) {
                num = i < 5 ? i : i === 5 ? -1 : totalPages - 1
              } else if (page > totalPages - 4) {
                num = i === 0 ? 0 : i === 1 ? -1 : totalPages - 5 + (i - 2)
              } else {
                num = i === 0 ? 0 : i === 1 ? -1 : i === 5 ? -1 : i === 6 ? totalPages - 1 : page - 1 + (i - 2)
              }
              if (num === -1) return <span key={`e-${i}`} className="px-1 text-faint text-xs">…</span>
              return (
                <button key={num} onClick={() => setPage(num)}
                  className={`w-7 h-7 rounded text-xs transition-colors ${
                    page === num ? 'bg-accent-primary text-white' : 'text-secondary hover:text-primary hover:bg-input'
                  }`}>
                  {num + 1}
                </button>
              )
            })}
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="px-2 py-1 rounded text-xs text-secondary hover:text-primary hover:bg-input disabled:opacity-30 transition-colors">
              ›
            </button>
          </div>
        )}
      </div>

      {loteOpen && (
        <LoteModal
          fichas={fichas.filter((f) => f.custo_total > 0 && f.preco_venda <= 0)}
          onClose={() => setLoteOpen(false)}
        />
      )}

      <ProdutoDetalheDrawer produtoId={detalheId} onClose={() => setDetalheId(null)} />
    </section>
  )
}
