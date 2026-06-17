'use client'

import { useState, useMemo } from 'react'
import { Plus, BookOpen, Search, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { normalizeSearch, formatBRL } from '@/lib/format'
import type { ReceitaComCusto } from '../types'
import { ReceitaModal } from './receita-modal'

interface Props {
  receitas: ReceitaComCusto[]
}

const TIPO_LABEL: Record<string, string> = {
  final: 'Final',
  base: 'Base',
}

export function ReceitaList({ receitas }: Props) {
  const [busca, setBusca] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalKey, setModalKey] = useState(0)

  const filtered = useMemo(() => {
    const term = normalizeSearch(busca)
    if (!term) return receitas
    return receitas.filter(r => normalizeSearch(r.nome).includes(term))
  }, [receitas, busca])

  function openCreate() {
    setModalKey(Date.now())
    setModalOpen(true)
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-demerara/50 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar receita…"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <button onClick={openCreate} className="btn-primary shrink-0">
          <Plus size={16} />
          Nova Receita
        </button>
      </div>

      {/* Estado vazio */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4">
            <BookOpen size={28} className="text-demerara/30" />
          </div>
          <p className="text-creme/70 text-base font-playfair mb-1">
            {receitas.length === 0 ? 'Nenhuma receita ainda' : 'Nenhum resultado'}
          </p>
          <p className="text-demerara text-sm max-w-xs">
            {receitas.length === 0
              ? 'Cadastre a primeira ficha técnica e comece a calcular custos de produção.'
              : 'Tente um termo diferente.'}
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
              className="card-surface flex items-center gap-4 px-5 py-4 group hover:bg-[#23232c] transition-colors block"
            >
              <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-5">
                {/* Nome + badges */}
                <div className="min-w-0 flex-1">
                  <p className="font-playfair text-creme text-[18px] font-semibold leading-tight truncate">
                    {receita.nome}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-croissant/12 text-croissant border border-croissant/20">
                      {TIPO_LABEL[receita.tipo] ?? receita.tipo}
                    </span>
                    <span className="text-demerara text-[12px]">
                      {receita.rendimento} {receita.rendimento_unidade}
                    </span>
                  </div>
                </div>

                {/* Custo */}
                <div className="shrink-0 sm:text-right">
                  {receita.custo_total != null && receita.custo_total > 0 ? (
                    <div>
                      <p className="font-playfair text-croissant text-[22px] sm:text-[26px] font-bold leading-none">
                        R$ {formatBRL(receita.custo_total)}
                      </p>
                      {receita.custo_unitario != null && (
                        <p className="text-demerara text-[12px] mt-0.5">
                          R$ {formatBRL(receita.custo_unitario)}/{receita.rendimento_unidade}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-demerara/40 text-xs italic">sem custo calculado</p>
                  )}
                </div>
              </div>

              {/* Seta */}
              <ChevronRight size={16} className="text-demerara/30 group-hover:text-demerara transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      )}

      {/* Contagem */}
      {receitas.length > 0 && filtered.length > 0 && (
        <p className="text-demerara/35 text-xs mt-4 text-right">
          {filtered.length === receitas.length
            ? `${receitas.length} receita${receitas.length !== 1 ? 's' : ''}`
            : `${filtered.length} de ${receitas.length} receitas`}
        </p>
      )}

      {/* Modal */}
      {modalOpen && (
        <ReceitaModal
          key={modalKey}
          receita={null}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}
