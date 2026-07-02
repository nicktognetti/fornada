'use client'

import { useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Tag, Search, ChevronDown, Check, Loader2 } from 'lucide-react'
import { normalizeSearch, parseDecimalBR, formatCustoGrande } from '@/lib/format'
import { addPrecosLote } from '../actions'

export interface InsumoParaPrecificar {
  id: string
  nome: string
  categoria: string | null
  unidade_uso: string
  custoAtual: number | null
}

interface Linha { unidade_compra: string; preco: string; qtd: string }

const VAZIA: Linha = { unidade_compra: '', preco: '', qtd: '' }

// Dicas por unidade de uso, para reduzir a fricção do preenchimento
function dicas(uso: string): { compra: string; qtd: string } {
  if (uso === 'ml') return { compra: 'ex: Garrafa 1L', qtd: 'ex: 1000' }
  if (uso === 'un') return { compra: 'ex: Cartela 30un', qtd: 'ex: 30' }
  return { compra: 'ex: Pacote 5kg', qtd: 'ex: 5000' }
}

type StatusFiltro = 'sem_preco' | 'todos'

export function PrecificarLoteGrid({ insumos, categorias }: { insumos: InsumoParaPrecificar[]; categorias: string[] }) {
  const router = useRouter()
  const [valores, setValores] = useState<Record<string, Linha>>({})
  const [busca, setBusca] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('sem_preco')
  const [saving, setSaving] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)
  const erroRef = useRef<string | null>(null)

  function set(id: string, campo: keyof Linha, v: string) {
    setResultado(null)
    setValores((prev) => ({ ...prev, [id]: { ...(prev[id] ?? VAZIA), [campo]: v } }))
  }

  const filtered = useMemo(() => {
    const term = normalizeSearch(busca)
    return insumos.filter((i) => {
      const matchBusca = !term || normalizeSearch(i.nome).includes(term) || normalizeSearch(i.categoria ?? '').includes(term)
      const matchCat = !categoriaFiltro || i.categoria === categoriaFiltro
      const matchStatus = statusFiltro === 'todos' || i.custoAtual == null
      return matchBusca && matchCat && matchStatus
    })
  }, [insumos, busca, categoriaFiltro, statusFiltro])

  // Linhas preenchidas e válidas (em todo o conjunto, não só no filtro visível)
  const preenchidos = useMemo(() => {
    return Object.entries(valores).filter(([, l]) => {
      const p = parseDecimalBR(l.preco); const q = parseDecimalBR(l.qtd)
      return p > 0 && q > 0
    })
  }, [valores])

  function custoPreview(id: string, uso: string): string | null {
    const l = valores[id]; if (!l) return null
    const p = parseDecimalBR(l.preco); const q = parseDecimalBR(l.qtd)
    if (!(p > 0) || !(q > 0)) return null
    return formatCustoGrande(p / q, uso)
  }

  async function salvar() {
    if (preenchidos.length === 0) return
    setSaving(true); setResultado(null)
    const items = preenchidos.map(([insumo_id, l]) => ({
      insumo_id, unidade_compra: l.unidade_compra, preco_compra: l.preco, qtd_uso_por_compra: l.qtd,
    }))
    const res = await addPrecosLote(items)
    setSaving(false)
    if (res.error && !res.salvos) { erroRef.current = res.error; setResultado(`Erro: ${res.error}`); return }
    const { salvos = 0, erros = 0 } = res
    setResultado(`${salvos} preço${salvos !== 1 ? 's' : ''} salvo${salvos !== 1 ? 's' : ''}${erros > 0 ? ` · ${erros} ignorado(s)` : ''}.`)
    setValores({})
    router.refresh()
  }

  const totalSemPreco = insumos.filter((i) => i.custoAtual == null).length

  return (
    <div className="space-y-5 pb-28">
      {/* Cabeçalho */}
      <div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent-primary/12 flex items-center justify-center">
            <Tag size={18} className="text-accent-primary" />
          </div>
          <div>
            <h1 className="font-playfair text-primary text-2xl font-bold leading-none">Precificar em lote</h1>
            <p className="text-secondary text-sm mt-1">
              Preencha preço e rendimento — o custo por unidade de uso é calculado na hora. {totalSemPreco} sem preço.
            </p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary/50 pointer-events-none" />
          <input type="text" placeholder="Buscar insumo…" value={busca} onChange={(e) => setBusca(e.target.value)} className="input-field pl-10" />
        </div>
        <div className="relative sm:w-48">
          <select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)} className="input-field appearance-none pr-9">
            <option value="">Todas as categorias</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary/60 pointer-events-none" />
        </div>
        <div className="inline-flex items-center gap-1 bg-input rounded-xl p-1">
          {([['sem_preco', 'Sem preço'], ['todos', 'Todos']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setStatusFiltro(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFiltro === k ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Grade */}
      <div className="rounded-xl bg-surface border border-subtle overflow-hidden">
        <div className="grid grid-cols-[1fr_140px_110px_140px_120px] gap-3 px-5 py-2.5 border-b border-subtle bg-canvas text-[10px] font-semibold uppercase tracking-wider text-faint">
          <span>Insumo</span>
          <span>Unidade de compra</span>
          <span className="text-right">Preço R$</span>
          <span className="text-right">Rende</span>
          <span className="text-right">Custo / uso</span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-faint text-sm">Nenhum insumo neste filtro.</div>
        ) : (
          filtered.map((i) => {
            const l = valores[i.id] ?? VAZIA
            const d = dicas(i.unidade_uso)
            const preview = custoPreview(i.id, i.unidade_uso)
            return (
              <div key={i.id} className="grid grid-cols-[1fr_140px_110px_140px_120px] gap-3 items-center px-5 py-2.5 border-b border-subtle last:border-0 hover:bg-canvas/30">
                <div className="min-w-0">
                  <p className="text-sm text-primary truncate" title={i.nome}>{i.nome}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {i.categoria && <span className="text-[11px] text-faint">{i.categoria}</span>}
                    {i.custoAtual != null && (
                      <span className="text-[10px] text-success">atual: {formatCustoGrande(i.custoAtual, i.unidade_uso)}</span>
                    )}
                  </div>
                </div>
                <input type="text" value={l.unidade_compra} placeholder={d.compra}
                  onChange={(e) => set(i.id, 'unidade_compra', e.target.value)}
                  className="input-field text-xs py-1.5 px-2" />
                <input type="text" inputMode="decimal" value={l.preco} placeholder="0,00"
                  onChange={(e) => set(i.id, 'preco', e.target.value)}
                  className="input-field text-xs py-1.5 px-2 text-right tabular-nums" />
                <div className="flex items-center gap-1 justify-end">
                  <input type="text" inputMode="decimal" value={l.qtd} placeholder={d.qtd}
                    onChange={(e) => set(i.id, 'qtd', e.target.value)}
                    className="input-field text-xs py-1.5 px-2 text-right tabular-nums w-full" />
                  <span className="text-[11px] text-faint shrink-0 w-5">{i.unidade_uso}</span>
                </div>
                <span className={`text-right text-sm tabular-nums ${preview ? 'text-accent-primary font-medium' : 'text-faint'}`}>
                  {preview ?? '—'}
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* Barra de ação fixa */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-subtle bg-surface/95 backdrop-blur px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="text-sm">
            {resultado ? (
              <span className={erroRef.current && resultado.startsWith('Erro') ? 'text-danger' : 'text-success'}>
                <Check size={13} className="inline mr-1" />{resultado}
              </span>
            ) : (
              <span className="text-secondary">
                <span className="text-primary font-semibold tabular-nums">{preenchidos.length}</span> preço(s) preenchido(s)
              </span>
            )}
          </div>
          <button onClick={salvar} disabled={saving || preenchidos.length === 0}
            className="btn-primary px-6 disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? <><Loader2 size={15} className="animate-spin" /> Salvando…</> : `Salvar ${preenchidos.length} preço(s)`}
          </button>
        </div>
      </div>
    </div>
  )
}
