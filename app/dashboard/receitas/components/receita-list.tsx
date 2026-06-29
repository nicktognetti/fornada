'use client'

import { useState, useMemo, useRef } from 'react'
import { Plus, BookOpen, Search, ChevronRight, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { normalizeSearch, formatBRL } from '@/lib/format'
import type { ReceitaComCusto } from '../types'
import { ReceitaModal } from './receita-modal'

interface Props {
  receitas: ReceitaComCusto[]
}

const TIPO_CONFIG: Record<string, { label: string; cls: string }> = {
  final: { label: 'PRODUTO', cls: 'bg-accent-primary/15 text-accent-primary border-accent-primary/20' },
  base:  { label: 'BASE',    cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
}

type TipoFiltro = '' | 'final' | 'base'

export function ReceitaList({ receitas }: Props) {
  const [busca, setBusca] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalKey, setModalKey] = useState(0)
  const keyRef = useRef(0)

  const filtered = useMemo(() => {
    const term = normalizeSearch(busca)
    return receitas.filter(r => {
      const matchBusca = !term || normalizeSearch(r.nome).includes(term)
      const matchTipo = !tipoFiltro || r.tipo === tipoFiltro
      return matchBusca && matchTipo
    })
  }, [receitas, busca, tipoFiltro])

  function openCreate() {
    setModalKey(keyRef.current += 1)
    setModalOpen(true)
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary/50 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar receita…"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="input-field pl-10"
          />
        </div>

        <div className="relative sm:w-44">
          <select
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value as TipoFiltro)}
            className="input-field appearance-none pr-9"
          >
            <option value="">Todos os tipos</option>
            <option value="final">Produto (final)</option>
            <option value="base">Base</option>
          </select>
          <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary/60 pointer-events-none" />
        </div>

        <button onClick={openCreate} className="btn-primary shrink-0">
          <Plus size={16} />
          Nova Receita
        </button>
      </div>

      {/* Estado vazio */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-input flex items-center justify-center mb-4">
            <BookOpen size={28} className="text-secondary/50" />
          </div>
          <p className="text-primary text-base font-playfair mb-1">
            {receitas.length === 0 ? 'Nenhuma receita ainda' : 'Nenhum resultado'}
          </p>
          <p className="text-secondary text-sm max-w-xs">
            {receitas.length === 0
              ? 'Cadastre a primeira ficha técnica e comece a calcular custos de produção.'
              : 'Tente um termo diferente ou ajuste o filtro de tipo.'}
          </p>
          {receitas.length === 0 && (
            <button onClick={openCreate} className="btn-primary mt-6">
              <Plus size={16} />
              Criar primeira receita
            </button>
          )}
        </div>
      )}

      {/* Cards */}
      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map(receita => (
            <Link
              key={receita.id}
              href={`/dashboard/receitas/${receita.id}`}
              className="card-surface flex items-center gap-4 px-5 py-4 group hover:shadow-md hover:bg-input transition-all duration-150 block cursor-pointer"
            >
              <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-5">
                <div className="min-w-0 flex-1">
                  <p className="font-playfair text-primary text-[18px] font-semibold leading-tight truncate">
                    {receita.nome}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {(() => {
                      const cfg = TIPO_CONFIG[receita.tipo]
                      return cfg ? (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border tracking-wider ${cfg.cls}`}>
                          {cfg.label}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-accent-primary/15 text-accent-primary border border-accent-primary/20">
                          {receita.tipo}
                        </span>
                      )
                    })()}
                    <span className="text-secondary text-[12px]">
                      {receita.rendimento} {receita.rendimento_unidade}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 sm:text-right">
                  {receita.custo_total != null && receita.custo_total > 0 ? (
                    <div>
                      <p className="font-playfair text-accent-primary text-[22px] sm:text-[26px] font-bold leading-none tabular-nums">
                        R$ {formatBRL(receita.custo_total)}
                      </p>
                      {receita.custo_unitario != null && (
                        <p className="text-secondary text-[12px] mt-0.5 tabular-nums">
                          R$ {formatBRL(receita.custo_unitario)}/{receita.rendimento_unidade}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-secondary/50 text-xs italic">sem custo calculado</p>
                  )}
                </div>
              </div>

              <ChevronRight size={16} className="text-secondary/30 group-hover:text-accent-primary transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      )}

      {/* Contagem */}
      {receitas.length > 0 && filtered.length > 0 && (
        <p className="text-secondary/40 text-xs mt-4 text-right">
          {filtered.length === receitas.length
            ? `${receitas.length} receita${receitas.length !== 1 ? 's' : ''}`
            : `${filtered.length} de ${receitas.length} receitas`}
        </p>
      )}

      {modalOpen && (
        <ReceitaModal key={modalKey} receita={null} onClose={() => setModalOpen(false)} />
      )}
    </>
  )
}
