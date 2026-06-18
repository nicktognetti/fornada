'use client'

import { useState, useMemo } from 'react'
import { Plus, Pencil, Package, Search, ChevronDown } from 'lucide-react'
import { normalizeSearch, formatCustoUso } from '@/lib/format'
import type { InsumoComCusto } from '../types'
import { InsumoModal } from './insumo-modal'

interface Props {
  insumos: InsumoComCusto[]
  categorias: string[]
}

interface ModalState {
  open: boolean
  insumo: InsumoComCusto | null
  key: number
}

type StatusFiltro = '' | 'pendentes' | 'com_preco'

function isPendente(insumo: InsumoComCusto) {
  return (
    insumo.nome.toLowerCase().includes('pendente') ||
    !insumo.custo ||
    insumo.custo.custo_uso == null ||
    insumo.custo.custo_uso === 0
  )
}

function temPreco(insumo: InsumoComCusto) {
  return insumo.custo != null && insumo.custo.custo_uso != null && insumo.custo.custo_uso > 0
}

export function InsumoList({ insumos, categorias }: Props) {
  const [busca, setBusca] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('')
  const [modal, setModal] = useState<ModalState>({ open: false, insumo: null, key: 0 })

  const filtered = useMemo(() => {
    const term = normalizeSearch(busca)
    return insumos.filter((i) => {
      const matchBusca =
        !term ||
        normalizeSearch(i.nome).includes(term) ||
        normalizeSearch(i.categoria ?? '').includes(term)
      const matchCat = !categoriaFiltro || i.categoria === categoriaFiltro
      const matchStatus =
        statusFiltro === '' ? true :
        statusFiltro === 'pendentes' ? isPendente(i) :
        statusFiltro === 'com_preco' ? temPreco(i) :
        true
      return matchBusca && matchCat && matchStatus
    })
  }, [insumos, busca, categoriaFiltro, statusFiltro])

  function openCreate() { setModal({ open: true, insumo: null, key: Date.now() }) }
  function openEdit(insumo: InsumoComCusto) { setModal({ open: true, insumo, key: Date.now() }) }
  function closeModal() { setModal((m) => ({ ...m, open: false })) }

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-demerara/50 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar insumo…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="input-field pl-10"
          />
        </div>

        <div className="relative sm:w-48">
          <select
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
            className="input-field appearance-none pr-9"
          >
            <option value="">Todas as categorias</option>
            {categorias.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-demerara/60 pointer-events-none" />
        </div>

        <div className="relative sm:w-40">
          <select
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value as StatusFiltro)}
            className="input-field appearance-none pr-9"
          >
            <option value="">Todos</option>
            <option value="pendentes">Pendentes</option>
            <option value="com_preco">Com preço</option>
          </select>
          <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-demerara/60 pointer-events-none" />
        </div>

        <button onClick={openCreate} className="btn-primary shrink-0">
          <Plus size={16} />
          Novo Insumo
        </button>
      </div>

      {/* Estado vazio */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-creme-100 flex items-center justify-center mb-4">
            <Package size={28} className="text-demerara/50" />
          </div>
          <p className="text-madrugada-800 text-base font-playfair mb-1">
            {insumos.length === 0 ? 'Nenhum insumo ainda' : 'Nenhum resultado'}
          </p>
          <p className="text-demerara text-sm max-w-xs">
            {insumos.length === 0
              ? 'Cadastre seu primeiro insumo para começar a calcular custos com precisão.'
              : 'Tente um termo diferente ou ajuste os filtros.'}
          </p>
          {insumos.length === 0 && (
            <button onClick={openCreate} className="btn-primary mt-6">
              <Plus size={16} />
              Cadastrar primeiro insumo
            </button>
          )}
        </div>
      )}

      {/* Lista de cards */}
      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((insumo) => (
            <div
              key={insumo.id}
              onClick={() => openEdit(insumo)}
              className="card-surface flex items-center gap-4 px-5 py-4 group hover:shadow-md hover:bg-creme-50 transition-all cursor-pointer"
            >
              <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-5">
                {/* Nome + tag */}
                <div className="min-w-0 flex-1">
                  <p className="font-playfair text-madrugada-800 text-[18px] font-semibold leading-tight truncate">
                    {insumo.nome}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {insumo.categoria && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-marrom-500/15 text-marrom-500 border border-marrom-500/20">
                        {insumo.categoria}
                      </span>
                    )}
                    <span className="text-demerara text-[12px]">{insumo.unidade_uso}</span>
                    {insumo.fichasCount > 0 && (
                      <span className="text-demerara/50 text-[12px]">
                        · em {insumo.fichasCount} ficha{insumo.fichasCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Custo + badges */}
                <div className="shrink-0 sm:text-right flex sm:flex-col items-center sm:items-end gap-2">
                  {insumo.custo?.custo_uso != null && insumo.custo.custo_uso > 0 ? (
                    <p className="font-playfair text-marrom-500 text-[22px] sm:text-[26px] font-bold leading-none">
                      {formatCustoUso(insumo.custo.custo_uso, insumo.unidade_uso)}
                    </p>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-600 border border-amber-500/25">
                      Sem preço
                    </span>
                  )}
                  {insumo.nome.toLowerCase().includes('pendente') && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-600 border border-amber-500/25">
                      Pendente
                    </span>
                  )}
                </div>
              </div>

              {/* Lápis — hover-only */}
              <button
                onClick={(e) => { e.stopPropagation(); openEdit(insumo) }}
                className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-demerara/40 hover:text-marrom-500 hover:bg-marrom-500/10 border border-transparent hover:border-marrom-500/20 transition-all opacity-0 group-hover:opacity-100"
                aria-label={`Editar ${insumo.nome}`}
              >
                <Pencil size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Contagem */}
      {insumos.length > 0 && filtered.length > 0 && (
        <p className="text-demerara/40 text-xs mt-4 text-right">
          {filtered.length === insumos.length
            ? `${insumos.length} insumo${insumos.length !== 1 ? 's' : ''}`
            : `${filtered.length} de ${insumos.length} insumos`}
        </p>
      )}

      {/* Modal */}
      {modal.open && (
        <InsumoModal
          key={modal.key}
          insumo={modal.insumo}
          categorias={categorias}
          onClose={closeModal}
        />
      )}
    </>
  )
}
