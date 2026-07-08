'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ChefHat, Search, Clock, ListOrdered, Plus, Tag, ChevronDown } from 'lucide-react'
import { normalizeSearch } from '@/lib/format'
import { LogoPlaceholder } from '@/app/components/ui/logo-placeholder'
import { NovaReceitaModal } from './nova-receita-modal'
import type { Dificuldade } from '@/app/dashboard/receitas/types'

export interface ReceitaCaderno {
  id: string
  nome: string
  tipo: string
  categoria: string | null
  rendimento: number
  rendimento_unidade: string
  foto_url: string | null
  passos: string[] | null
  tempo_preparo_min: number | null
  dificuldade: Dificuldade | null
  revisao_pendente: boolean
}

interface Props {
  receitas: ReceitaCaderno[]
  podeCriar: boolean
}

export function CadernoCatalogo({ receitas, podeCriar }: Props) {
  const [busca, setBusca] = useState('')
  const [setor, setSetor] = useState('')
  const [novaOpen, setNovaOpen] = useState(false)

  // Setores existentes (para o filtro), em ordem alfabética.
  const setores = useMemo(() => {
    const set = new Set<string>()
    for (const r of receitas) if (r.categoria?.trim()) set.add(r.categoria.trim())
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [receitas])

  const filtered = useMemo(() => {
    const term = normalizeSearch(busca)
    return receitas.filter((r) => {
      const matchBusca = !term || normalizeSearch(r.nome).includes(term)
      const matchSetor = !setor || (r.categoria?.trim() ?? '') === setor
      return matchBusca && matchSetor
    })
  }, [receitas, busca, setor])

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary/50 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar receita…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        {setores.length > 0 && (
          <div className="relative sm:w-52">
            <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary/50 pointer-events-none" />
            <select
              value={setor}
              onChange={(e) => setSetor(e.target.value)}
              className="input-field appearance-none pl-9 pr-9"
            >
              <option value="">Todos os setores</option>
              {setores.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary/60 pointer-events-none" />
          </div>
        )}
        {podeCriar && (
          <button onClick={() => setNovaOpen(true)} className="btn-primary shrink-0">
            <Plus size={16} />
            Nova Receita
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-input flex items-center justify-center mb-4">
            <ChefHat size={28} className="text-secondary/50" />
          </div>
          <p className="text-primary text-base font-playfair mb-1">
            {receitas.length === 0 ? 'Nenhuma receita ainda' : 'Nenhum resultado'}
          </p>
          <p className="text-secondary text-sm max-w-xs">
            {receitas.length === 0
              ? 'Crie a primeira receita ou cadastre uma ficha técnica — as duas aparecem aqui para a produção seguir.'
              : 'Tente um termo diferente.'}
          </p>
          {podeCriar && receitas.length === 0 && (
            <button onClick={() => setNovaOpen(true)} className="btn-primary mt-6">
              <Plus size={16} />
              Criar primeira receita
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((r) => {
            const temPreparo = (r.passos?.length ?? 0) > 0
            return (
              <Link
                key={r.id}
                href={`/dashboard/caderno/${r.id}`}
                className="card-surface group overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 flex flex-col"
              >
                {/* Foto */}
                <div className="aspect-[4/3] overflow-hidden">
                  {r.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.foto_url} alt={r.nome} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200" />
                  ) : (
                    <LogoPlaceholder className="w-full h-full" />
                  )}
                </div>

                {/* Info */}
                <div className="p-3.5 flex-1 flex flex-col">
                  {r.categoria?.trim() && (
                    <span className="inline-flex items-center gap-1 self-start rounded-full bg-accent-primary/12 text-accent-primary border border-accent-primary/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide mb-1.5">
                      <Tag size={9} /> {r.categoria.trim()}
                    </span>
                  )}
                  <p className="font-playfair text-primary text-[16px] font-semibold leading-tight line-clamp-2">
                    {r.nome}
                  </p>
                  <p className="text-secondary text-xs mt-1">
                    Rende {r.rendimento} {r.rendimento_unidade}
                  </p>
                  <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                    {r.tempo_preparo_min != null && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-secondary">
                        <Clock size={11} /> {r.tempo_preparo_min} min
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1 text-[11px] ${temPreparo ? 'text-accent-primary' : 'text-secondary/50'}`}>
                      <ListOrdered size={11} />
                      {temPreparo ? `${r.passos!.length} passo${r.passos!.length > 1 ? 's' : ''}` : 'sem passos'}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {receitas.length > 0 && filtered.length > 0 && (
        <p className="text-secondary/40 text-xs mt-5 text-right">
          {filtered.length === receitas.length
            ? `${receitas.length} receita${receitas.length !== 1 ? 's' : ''}`
            : `${filtered.length} de ${receitas.length} receitas`}
        </p>
      )}

      {novaOpen && <NovaReceitaModal onClose={() => setNovaOpen(false)} />}
    </>
  )
}
