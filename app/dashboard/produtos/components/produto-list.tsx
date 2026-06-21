'use client'

import { useState } from 'react'
import { Pencil, Package, ShoppingBag, Search, Plus } from 'lucide-react'
import { formatBRL } from '@/lib/format'
import type { ProdutoFinanceiro } from '@/app/actions/painel'
import { NovoProdutoModal } from './novo-produto-modal'

interface Props {
  produtos: ProdutoFinanceiro[]
  unidades: { id: string; nome: string }[]
  receitas: { id: string; nome: string }[]
}

const TIPO_CONFIG = {
  produzido: { icon: Package, label: 'Fabricado', cls: 'bg-accent-primary/15 text-accent-primary border-accent-primary/20' },
  revenda:   { icon: ShoppingBag, label: 'Revenda',   cls: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
}

export function ProdutoList({ produtos, unidades, receitas }: Props) {
  const [search, setSearch] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'produzido' | 'revenda'>('todos')
  const [modalOpen, setModalOpen] = useState(false)

  const filtered = produtos.filter((p) => {
    const matchNome = !search || p.produto_nome.toLowerCase().includes(search.toLowerCase())
    const matchTipo = tipoFiltro === 'todos' || p.produto_tipo === tipoFiltro
    return matchNome && matchTipo
  })

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary/50 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar produto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <div className="flex items-center gap-1 bg-input rounded-xl p-1">
          {(['todos', 'produzido', 'revenda'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTipoFiltro(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tipoFiltro === t
                  ? 'bg-surface text-primary shadow-sm'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              {t === 'todos' ? 'Todos' : t === 'produzido' ? 'Fabricados' : 'Revenda'}
            </button>
          ))}
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary shrink-0">
          <Plus size={16} />
          Novo Produto
        </button>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-input flex items-center justify-center mb-4">
            <Package size={28} className="text-secondary/50" />
          </div>
          <p className="text-primary text-base font-playfair mb-1">
            {produtos.length === 0 ? 'Nenhum produto ainda' : 'Nenhum resultado'}
          </p>
          <p className="text-secondary text-sm max-w-xs">
            {produtos.length === 0
              ? 'Crie produtos fabricados (ligados a fichas técnicas) ou produtos de revenda.'
              : 'Tente um termo diferente ou ajuste os filtros.'}
          </p>
        </div>
      )}

      {/* Lista */}
      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((p) => {
            const tipoConf = TIPO_CONFIG[p.produto_tipo] ?? TIPO_CONFIG.produzido
            const Icon = tipoConf.icon
            const comPreco = p.preco_venda > 0
            const margem = comPreco ? p.margem_percentual : null

            return (
              <div key={p.produto_id} className="card-surface flex items-center gap-4 px-5 py-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'var(--color-input)' }}>
                  <Icon size={16} className="text-secondary" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-playfair text-primary text-[17px] font-semibold leading-tight">
                      {p.produto_nome}
                    </p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border ${tipoConf.cls}`}>
                      {tipoConf.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {p.categoria && (
                      <span className="text-secondary text-xs">{p.categoria}</span>
                    )}
                    <span className="text-secondary text-xs">
                      custo: {p.custo_total > 0 ? `R$ ${formatBRL(p.custo_total)}` : '—'}
                    </span>
                    {p.unidade_nome && (
                      <span className="text-faint text-xs">{p.unidade_nome}</span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  {comPreco ? (
                    <>
                      <p className="font-playfair text-primary text-[18px] font-bold leading-none">
                        R$ {formatBRL(p.preco_venda)}
                      </p>
                      {margem !== null && (
                        <p className={`text-[11px] mt-0.5 ${margem < 0 ? 'text-danger' : margem < 20 ? 'text-amber-400' : 'text-success'}`}>
                          {margem.toFixed(1)}% margem
                        </p>
                      )}
                    </>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/25">
                      sem preço
                    </span>
                  )}
                </div>

                <button
                  className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-secondary/40 hover:text-accent-primary hover:bg-accent-primary/10 border border-transparent hover:border-accent-primary/20 transition-all"
                  title="Editar produto"
                >
                  <Pencil size={15} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {produtos.length > 0 && (
        <p className="text-secondary/40 text-xs mt-4 text-right">
          {filtered.length === produtos.length
            ? `${produtos.length} produto${produtos.length !== 1 ? 's' : ''}`
            : `${filtered.length} de ${produtos.length} produtos`}
        </p>
      )}

      {modalOpen && (
        <NovoProdutoModal
          unidades={unidades}
          receitas={receitas}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}
