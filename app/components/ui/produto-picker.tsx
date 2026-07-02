'use client'

import { useState, useMemo } from 'react'
import { Search, Plus, X } from 'lucide-react'
import { formatBRL, normalizeSearch } from '@/lib/format'
import type { ProdutoOrcamento } from '@/app/actions/orcamento'

const LIMITE = 60

/**
 * Seletor de produto com busca instantânea + filtro por categoria.
 * Substitui o <select> simples — pensado para catálogos grandes.
 * Ao clicar num resultado, chama onPick (adiciona a linha). Botão "Avulso" à parte.
 */
export function ProdutoPicker({
  produtos, onPick, onAvulso,
}: {
  produtos: ProdutoOrcamento[]
  onPick: (p: ProdutoOrcamento) => void
  onAvulso: () => void
}) {
  const [busca, setBusca] = useState('')
  const [cat, setCat] = useState<string | null>(null)

  const categorias = useMemo(() => {
    const s = new Set<string>()
    produtos.forEach((p) => { if (p.categoria) s.add(p.categoria) })
    return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [produtos])

  const filtrados = useMemo(() => {
    const t = normalizeSearch(busca)
    return produtos.filter((p) => {
      const mCat = !cat || p.categoria === cat
      const mBusca = !t || normalizeSearch(p.nome).includes(t)
      return mCat && mBusca
    })
  }, [produtos, busca, cat])

  const visiveis = filtrados.slice(0, LIMITE)
  const ocultos = filtrados.length - visiveis.length

  const chip = (label: string, active: boolean, onClick: () => void) => (
    <button key={label} onClick={onClick} type="button"
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${active ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}>
      {label}
    </button>
  )

  return (
    <div className="space-y-3">
      {/* Busca + Avulso */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary/50 pointer-events-none" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto pelo nome…"
            className="input-field text-sm pl-10 pr-9 w-full"
            autoComplete="off"
          />
          {busca && (
            <button onClick={() => setBusca('')} type="button" aria-label="Limpar busca"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary/50 hover:text-primary">
              <X size={14} />
            </button>
          )}
        </div>
        <button onClick={onAvulso} type="button" title="Adicionar um item que não está no catálogo"
          className="px-4 shrink-0 rounded-xl text-sm font-medium border border-subtle text-ink-soft hover:text-primary hover:bg-input transition-colors">
          + Avulso
        </button>
      </div>

      {/* Filtro por categoria */}
      {categorias.length > 1 && (
        <div className="flex items-center gap-1 bg-input rounded-xl p-1 overflow-x-auto">
          {chip('Todas', !cat, () => setCat(null))}
          {categorias.map((c) => chip(c, cat === c, () => setCat(c)))}
        </div>
      )}

      {/* Resultados */}
      <div className="card-surface overflow-hidden">
        {visiveis.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-secondary">Nenhum produto encontrado.</p>
        ) : (
          <div className="max-h-64 overflow-y-auto divide-y divide-subtle">
            {visiveis.map((p) => (
              <button key={p.id} onClick={() => onPick(p)} type="button"
                className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-input transition-colors group">
                <span className="min-w-0 flex items-center gap-2">
                  <Plus size={14} className="text-accent-primary/50 group-hover:text-accent-primary shrink-0" />
                  <span className="truncate text-sm text-primary">{p.nome}</span>
                  {p.categoria && <span className="text-[10px] text-faint uppercase tracking-wider shrink-0 hidden sm:inline">{p.categoria}</span>}
                </span>
                <span className="text-sm text-secondary tabular-nums shrink-0">{p.preco_base > 0 ? `R$ ${formatBRL(p.preco_base)}${p.unidade_venda ? `/${p.unidade_venda}` : ''}` : '—'}</span>
              </button>
            ))}
          </div>
        )}
        {ocultos > 0 && (
          <p className="px-4 py-2 text-[11px] text-faint border-t border-subtle bg-canvas">
            +{ocultos} produto{ocultos > 1 ? 's' : ''} — refine a busca para ver.
          </p>
        )}
      </div>
    </div>
  )
}
