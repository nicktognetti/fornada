'use client'

import { useState, useMemo, useCallback } from 'react'
import { Play, TrendingUp, TrendingDown, Minus, RotateCcw, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { parseDecimalBR, formatBRL } from '@/lib/format'
import type { ProdutoRentabilidade } from '@/app/dashboard/painel/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type Ajuste = { percentual: number; novoPreco: number }
type AjustesMap = Map<string, Ajuste>
type SortCol = 'nome' | 'preco' | 'ajuste' | 'novoPreco' | 'margem' | 'novaMargem'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 20
const INPUT = 'w-full bg-input border border-subtle rounded-lg px-3 py-2 text-sm text-primary placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent-primary/40 focus:border-accent-primary transition-colors'

interface Props {
  produtos: ProdutoRentabilidade[]
  totalDespesas?: number
}

// ── helpers ───────────────────────────────────────────────────────────────────

function calcNovoPreco(preco: number, pct: number): number {
  return preco * (1 + pct / 100)
}
function calcNovaMargem(novoPreco: number, custo: number): number {
  if (novoPreco <= 0) return 0
  return ((novoPreco - custo) / novoPreco) * 100
}
function corMargem(m: number) {
  if (m >= 40) return 'text-success'
  if (m >= 20) return 'text-amber-400'
  return 'text-danger'
}

// ── SortHeader ────────────────────────────────────────────────────────────────

function SortHeader({ col, label, sortCol, sortDir, onSort, className }: {
  col: SortCol; label: string; sortCol: SortCol; sortDir: SortDir
  onSort: (c: SortCol) => void; className?: string
}) {
  const ativo = sortCol === col
  return (
    <button onClick={() => onSort(col)}
      className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider transition-colors group ${
        ativo ? 'text-primary' : 'text-faint hover:text-secondary'
      } ${className ?? ''}`}>
      {label}
      <span className={`transition-opacity ${ativo ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}>
        {ativo && sortDir === 'asc' ? <ChevronUp size={9} /> : ativo && sortDir === 'desc' ? <ChevronDown size={9} /> : <ChevronsUpDown size={9} />}
      </span>
    </button>
  )
}

// ── AjusteInput ───────────────────────────────────────────────────────────────

function AjusteInput({ produto, ajuste, onChange }: {
  produto: ProdutoRentabilidade; ajuste: Ajuste | undefined; onChange: (id: string, pct: number) => void
}) {
  const [draft, setDraft] = useState(ajuste ? ajuste.percentual.toFixed(1) : '')
  function commit() {
    const v = parseDecimalBR(draft)
    if (Number.isNaN(v)) { setDraft(''); onChange(produto.id, 0); return }
    onChange(produto.id, v)
  }
  const pct = ajuste?.percentual ?? 0
  const cor = pct > 0 ? 'text-success' : pct < 0 ? 'text-danger' : 'text-faint'
  return (
    <div className="flex items-center gap-1 w-28 justify-end">
      <input type="text" inputMode="decimal" value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit() } }}
        placeholder="0"
        className="input-field text-xs py-1 px-2 w-16 text-right tabular-nums" />
      <span className={`text-xs ${cor} w-3`}>%</span>
    </div>
  )
}

// ── SimuladorResumo ───────────────────────────────────────────────────────────

function SimuladorResumo({ produtos, ajustes, totalDespesas }: {
  produtos: ProdutoRentabilidade[]; ajustes: AjustesMap; totalDespesas: number
}) {
  const stats = useMemo(() => {
    const ajustados = produtos.filter((p) => ajustes.has(p.id) && ajustes.get(p.id)!.percentual !== 0)
    if (ajustados.length === 0) return null
    const totalAtual = ajustados.reduce((s, p) => s + p.preco, 0)
    const totalNovo  = ajustados.reduce((s, p) => s + ajustes.get(p.id)!.novoPreco, 0)
    const diff       = totalNovo - totalAtual
    const diffPct    = totalAtual > 0 ? (diff / totalAtual) * 100 : 0
    const margemAtual = ajustados.reduce((s, p) => s + p.margem, 0) / ajustados.length
    const margemNova  = ajustados.reduce((s, p) => s + calcNovaMargem(ajustes.get(p.id)!.novoPreco, p.custo), 0) / ajustados.length
    const pontoNovo   = totalDespesas > 0 && margemNova > 0 ? totalDespesas / (margemNova / 100) : null
    return { qtd: ajustados.length, totalAtual, totalNovo, diff, diffPct, margemAtual, margemNova, pontoNovo }
  }, [produtos, ajustes, totalDespesas])

  if (!stats) return null
  return (
    <div className="card-surface px-5 py-4 space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary">
        Resumo · {stats.qtd} produto{stats.qtd !== 1 ? 's' : ''} ajustado{stats.qtd !== 1 ? 's' : ''}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-[10px] text-faint mb-0.5">Total Atual</p>
          <p className="font-playfair font-bold text-xl tabular-nums text-secondary">R$ {formatBRL(stats.totalAtual)}</p>
        </div>
        <div>
          <p className="text-[10px] text-faint mb-0.5">Total Simulado</p>
          <p className="font-playfair font-bold text-xl tabular-nums text-primary">R$ {formatBRL(stats.totalNovo)}</p>
        </div>
        <div>
          <p className="text-[10px] text-faint mb-0.5">Diferença</p>
          <p className={`font-playfair font-bold text-xl tabular-nums ${stats.diff >= 0 ? 'text-success' : 'text-danger'}`}>
            {stats.diff >= 0 ? '+' : ''}R$ {formatBRL(Math.abs(stats.diff))}
            <span className="text-sm ml-1 font-normal">({stats.diff >= 0 ? '+' : ''}{stats.diffPct.toFixed(1)}%)</span>
          </p>
        </div>
        <div>
          <p className="text-[10px] text-faint mb-0.5">Margem Média</p>
          <div className="flex items-center gap-2">
            <span className="text-sm tabular-nums text-secondary">{stats.margemAtual.toFixed(1)}%</span>
            {stats.margemNova > stats.margemAtual ? <TrendingUp size={13} className="text-success" /> :
             stats.margemNova < stats.margemAtual ? <TrendingDown size={13} className="text-danger" /> :
             <Minus size={13} className="text-faint" />}
            <span className={`font-bold tabular-nums ${corMargem(stats.margemNova)}`}>{stats.margemNova.toFixed(1)}%</span>
          </div>
        </div>
      </div>
      {stats.pontoNovo !== null && (
        <p className="text-[11px] text-faint">
          Ponto de equilíbrio simulado: <span className="text-secondary font-medium">R$ {formatBRL(stats.pontoNovo)}</span>
        </p>
      )}
    </div>
  )
}

// ── SimuladorGraficos ─────────────────────────────────────────────────────────

function SimuladorGraficos({ produtos, ajustes }: { produtos: ProdutoRentabilidade[]; ajustes: AjustesMap }) {
  const ajustados = useMemo(
    () => produtos.filter((p) => ajustes.has(p.id) && ajustes.get(p.id)!.percentual !== 0).slice(0, 10),
    [produtos, ajustes]
  )
  if (ajustados.length === 0) return null
  const maxPreco = Math.max(...ajustados.flatMap((p) => [p.preco, ajustes.get(p.id)!.novoPreco]), 1)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="card-surface px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary mb-3">Comparativo de Preços</p>
        <div className="space-y-3">
          {ajustados.map((p) => {
            const np = ajustes.get(p.id)!.novoPreco
            const wA = (p.preco / maxPreco) * 100
            const wN = (np / maxPreco) * 100
            const corBarra = np > p.preco ? 'var(--color-success)' : 'var(--color-danger)'
            return (
              <div key={p.id}>
                <p className="text-[10px] text-faint mb-1 truncate">{p.nome}</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-surface-2 rounded-full h-1.5">
                      <div className="h-full rounded-full bg-secondary/40" style={{ width: `${wA}%` }} />
                    </div>
                    <span className="text-[10px] tabular-nums text-secondary w-16 text-right shrink-0">R$ {formatBRL(p.preco)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-surface-2 rounded-full h-1.5">
                      <div className="h-full rounded-full transition-all" style={{ width: `${wN}%`, backgroundColor: corBarra }} />
                    </div>
                    <span className="text-[10px] tabular-nums font-semibold w-16 text-right shrink-0" style={{ color: corBarra }}>R$ {formatBRL(np)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex gap-3 mt-3 text-[10px] text-faint">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-1.5 rounded-full bg-secondary/40" />Atual</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-1.5 rounded-full bg-success" />▲</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-1.5 rounded-full bg-danger" />▼</span>
        </div>
      </div>
      <div className="card-surface px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary mb-3">Impacto na Margem</p>
        <div className="space-y-3">
          {ajustados.map((p) => {
            const np  = ajustes.get(p.id)!.novoPreco
            const nm  = calcNovaMargem(np, p.custo)
            const delta = nm - p.margem
            const wA  = Math.min(Math.max(p.margem, 0), 80) / 80 * 100
            const wN  = Math.min(Math.max(nm, 0), 80) / 80 * 100
            const barColor = nm >= 40 ? 'var(--color-success)' : nm >= 20 ? 'var(--color-warning)' : 'var(--color-danger)'
            return (
              <div key={p.id}>
                <div className="flex items-center justify-between text-[10px] text-faint mb-1">
                  <span className="truncate max-w-[140px]">{p.nome}</span>
                  <span className={`font-semibold ${delta > 0 ? 'text-success' : delta < 0 ? 'text-danger' : 'text-faint'}`}>
                    {delta > 0 ? '+' : ''}{delta.toFixed(1)} pp
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-surface-2 rounded-full h-1.5">
                      <div className="h-full rounded-full bg-secondary/40" style={{ width: `${wA}%` }} />
                    </div>
                    <span className="text-[10px] tabular-nums text-secondary w-12 text-right shrink-0">{p.margem.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-surface-2 rounded-full h-1.5">
                      <div className="h-full rounded-full" style={{ width: `${wN}%`, backgroundColor: barColor }} />
                    </div>
                    <span className={`text-[10px] tabular-nums font-semibold w-12 text-right shrink-0 ${corMargem(nm)}`}>{nm.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── SimuladorTabela ───────────────────────────────────────────────────────────

function SimuladorTabela({ produtos, ajustes, onChange }: {
  produtos: ProdutoRentabilidade[]; ajustes: AjustesMap; onChange: (id: string, pct: number) => void
}) {
  const [search, setSearch]   = useState('')
  const [sortCol, setSortCol] = useState<SortCol>('nome')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage]       = useState(0)

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
    setPage(0)
  }

  const filtered = useMemo(() => {
    const list = search ? produtos.filter((p) => p.nome.toLowerCase().includes(search.toLowerCase())) : produtos
    return [...list].sort((a, b) => {
      const aj_a = ajustes.get(a.id); const aj_b = ajustes.get(b.id)
      let va: number | string = 0; let vb: number | string = 0
      if (sortCol === 'nome')      { va = a.nome; vb = b.nome }
      else if (sortCol === 'preco')     { va = a.preco; vb = b.preco }
      else if (sortCol === 'ajuste')    { va = aj_a?.percentual ?? 0; vb = aj_b?.percentual ?? 0 }
      else if (sortCol === 'novoPreco') { va = aj_a?.novoPreco ?? a.preco; vb = aj_b?.novoPreco ?? b.preco }
      else if (sortCol === 'margem')    { va = a.margem; vb = b.margem }
      else { va = calcNovaMargem(aj_a?.novoPreco ?? a.preco, a.custo); vb = calcNovaMargem(aj_b?.novoPreco ?? b.preco, b.custo) }
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb as string, 'pt-BR') : (vb as string).localeCompare(va, 'pt-BR')
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })
  }, [produtos, ajustes, search, sortCol, sortDir])

  const total = filtered.length; const totalPages = Math.ceil(total / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-secondary">{total} produto{total !== 1 ? 's' : ''}</p>
        <input type="search" placeholder="Buscar produto…" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          className="input-field text-sm py-1.5 w-48" />
      </div>
      <div className="rounded-xl bg-surface border border-subtle overflow-hidden">
        <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 px-5 py-2.5 border-b border-subtle bg-canvas">
          <SortHeader col="nome"       label="Produto"      sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
          <SortHeader col="preco"      label="Preço Atual"  sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="w-24 justify-end" />
          <SortHeader col="ajuste"     label="Ajuste %"     sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="w-28 justify-end" />
          <SortHeader col="novoPreco"  label="Novo Preço"   sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="w-24 justify-end" />
          <SortHeader col="margem"     label="Margem Atual" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="w-24 justify-end" />
          <SortHeader col="novaMargem" label="Nova Margem"  sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="w-24 justify-end" />
        </div>
        {paged.length === 0 ? (
          <div className="py-10 text-center text-faint text-sm">Nenhum produto encontrado</div>
        ) : paged.map((p) => {
          const aj = ajustes.get(p.id)
          const novoPreco  = aj?.novoPreco ?? p.preco
          const novaMargem = calcNovaMargem(novoPreco, p.custo)
          const temAjuste  = Boolean(aj && aj.percentual !== 0)
          return (
            <div key={p.id} className={`grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 items-center px-5 py-3 border-b border-subtle last:border-0 transition-colors ${
              temAjuste ? 'bg-accent-primary/[0.03]' : 'hover:bg-canvas/40'
            }`}>
              <div className="min-w-0">
                <p className="text-sm font-medium text-primary truncate" title={p.nome}>{p.nome}</p>
                <p className="text-[11px] text-faint">custo R$ {formatBRL(p.custo)}</p>
              </div>
              <span className="w-24 text-right text-sm tabular-nums text-secondary">R$ {formatBRL(p.preco)}</span>
              <div className="w-28 flex justify-end">
                <AjusteInput produto={p} ajuste={aj} onChange={onChange} />
              </div>
              <span className={`w-24 text-right text-sm tabular-nums font-semibold ${temAjuste ? 'text-primary' : 'text-faint'}`}>
                {temAjuste ? `R$ ${formatBRL(novoPreco)}` : '—'}
              </span>
              <span className={`w-24 text-right text-sm tabular-nums ${corMargem(p.margem)}`}>{p.margem.toFixed(1)}%</span>
              <span className={`w-24 text-right text-sm tabular-nums font-semibold ${temAjuste ? corMargem(novaMargem) : 'text-faint'}`}>
                {temAjuste ? `${novaMargem.toFixed(1)}%` : '—'}
              </span>
            </div>
          )
        })}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-2 px-1">
          <p className="text-[11px] text-faint">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((x) => Math.max(0, x - 1))} disabled={page === 0}
              className="px-2 py-1 rounded text-xs text-secondary hover:text-primary hover:bg-input disabled:opacity-30 transition-colors">‹</button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
              <button key={i} onClick={() => setPage(i)}
                className={`w-7 h-7 rounded text-xs transition-colors ${page === i ? 'bg-accent-primary text-white' : 'text-secondary hover:text-primary hover:bg-input'}`}>
                {i + 1}
              </button>
            ))}
            <button onClick={() => setPage((x) => Math.min(totalPages - 1, x + 1))} disabled={page >= totalPages - 1}
              className="px-2 py-1 rounded text-xs text-secondary hover:text-primary hover:bg-input disabled:opacity-30 transition-colors">›</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Controles globais ─────────────────────────────────────────────────────────

function ControlesGlobais({ produtos, onAplicar }: {
  produtos: ProdutoRentabilidade[]; onAplicar: (m: AjustesMap) => void
}) {
  const [pctInput, setPctInput] = useState('10')
  const [direcao, setDirecao]   = useState<'aumento' | 'reducao'>('aumento')
  const [filtro, setFiltro]     = useState('todos')

  function aplicar() {
    const pct = parseDecimalBR(pctInput)
    if (Number.isNaN(pct) || pct <= 0) return
    const fator = direcao === 'aumento' ? pct : -pct
    const alvo  = filtro === 'todos' ? produtos : produtos.filter((p) => p.id === filtro)
    const novo: AjustesMap = new Map()
    for (const p of alvo) novo.set(p.id, { percentual: fator, novoPreco: calcNovoPreco(p.preco, fator) })
    onAplicar(novo)
  }

  return (
    <div className="card-surface px-5 py-5 space-y-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Aplicar ajuste uniforme</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="field-label mb-1.5">Variação (%)</label>
          <div className="relative">
            <input type="text" inputMode="decimal" value={pctInput} onChange={(e) => setPctInput(e.target.value)}
              className={`${INPUT} pr-8`} placeholder="10" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-faint">%</span>
          </div>
        </div>
        <div>
          <p className="field-label mb-1.5">Direção</p>
          <div className="flex bg-input p-1 rounded-lg gap-1 h-[38px]">
            {(['aumento', 'reducao'] as const).map((k) => (
              <button key={k} onClick={() => setDirecao(k)}
                className={`flex-1 rounded-md text-sm font-medium transition-all ${
                  direcao === k ? 'bg-accent-primary text-accent-ink font-semibold shadow-sm' : 'text-secondary hover:text-ink-soft'
                }`}>
                {k === 'aumento' ? '▲ Aumento' : '▼ Redução'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="field-label mb-1.5">Produto</label>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className={INPUT}>
            <option value="todos">Todos os produtos</option>
            {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
      </div>
      <button onClick={aplicar} disabled={produtos.length === 0}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent-primary hover:bg-accent-hover text-accent-ink text-sm font-semibold shadow-sm transition-colors disabled:opacity-40">
        <Play size={14} />
        Aplicar ajuste
      </button>
    </div>
  )
}

// ── SimuladorClient ───────────────────────────────────────────────────────────

export function SimuladorClient({ produtos, totalDespesas = 0 }: Props) {
  const [ajustes, setAjustes] = useState<AjustesMap>(new Map())

  const handleChange = useCallback((id: string, pct: number) => {
    setAjustes((prev) => {
      const next = new Map(prev)
      if (pct === 0) { next.delete(id); return next }
      const p = produtos.find((x) => x.id === id)
      if (!p) return prev
      next.set(id, { percentual: pct, novoPreco: calcNovoPreco(p.preco, pct) })
      return next
    })
  }, [produtos])

  const handleAplicar = useCallback((novos: AjustesMap) => {
    setAjustes((prev) => {
      const next = new Map(prev)
      novos.forEach((v, k) => next.set(k, v))
      return next
    })
  }, [])

  const temAjustes = ajustes.size > 0

  if (produtos.length === 0) {
    return (
      <div className="card-surface p-10 flex flex-col items-center text-center gap-3">
        <Play size={24} className="text-faint" />
        <p className="text-primary font-playfair text-lg font-semibold">Nenhum produto disponível</p>
        <p className="text-secondary text-sm max-w-xs">
          Cadastre custos e preços nos módulos de Fichas e Preços para usar o simulador.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <ControlesGlobais produtos={produtos} onAplicar={handleAplicar} />

      {temAjustes && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-secondary">
            {ajustes.size} produto{ajustes.size !== 1 ? 's' : ''} com ajuste
          </p>
          <button onClick={() => setAjustes(new Map())}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-subtle text-secondary hover:text-ink-soft hover:bg-input text-xs font-medium transition-colors">
            <RotateCcw size={11} />
            Limpar simulação
          </button>
        </div>
      )}

      {temAjustes && <SimuladorResumo produtos={produtos} ajustes={ajustes} totalDespesas={totalDespesas} />}
      {temAjustes && <SimuladorGraficos produtos={produtos} ajustes={ajustes} />}

      <SimuladorTabela produtos={produtos} ajustes={ajustes} onChange={handleChange} />

      {!temAjustes && (
        <div className="card-surface p-8 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-accent-primary/10 flex items-center justify-center">
            <Play size={20} className="text-accent-primary/60" />
          </div>
          <p className="text-primary font-playfair text-lg font-semibold">Pronto para simular</p>
          <p className="text-secondary text-sm max-w-sm">
            Use o painel acima para aplicar um ajuste uniforme, ou edite o campo{' '}
            <strong className="text-ink-soft">Ajuste %</strong> de cada produto na tabela.
            Nenhum dado é salvo — a simulação é volátil.
          </p>
        </div>
      )}
    </div>
  )
}
