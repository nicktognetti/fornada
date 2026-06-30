'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { FileText, Plus, Search } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { formatBRL, normalizeSearch } from '@/lib/format'
import type { OrcamentoListItem } from '@/app/actions/orcamento'

function formatData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function OrcamentosList({ inicial }: { inicial: OrcamentoListItem[] }) {
  const [busca, setBusca] = useState('')
  const filtrados = useMemo(() => {
    const t = normalizeSearch(busca)
    return t ? inicial.filter((o) => normalizeSearch(o.cliente_nome).includes(t)) : inicial
  }, [inicial, busca])

  return (
    <div>
      <PageTitle icon={FileText} subtitle="Orçamentos para clientes">Orçamentos</PageTitle>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary/50 pointer-events-none" />
          <input type="text" placeholder="Buscar por cliente…" value={busca} onChange={(e) => setBusca(e.target.value)} className="input-field pl-10" />
        </div>
        <Link href="/dashboard/orcamentos/novo" className="btn-primary shrink-0">
          <Plus size={16} />
          Novo orçamento
        </Link>
      </div>

      {filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-input flex items-center justify-center mb-4">
            <FileText size={28} className="text-secondary/50" />
          </div>
          <p className="text-primary text-base font-playfair mb-1">
            {inicial.length === 0 ? 'Nenhum orçamento ainda' : 'Nenhum resultado'}
          </p>
          <p className="text-secondary text-sm max-w-xs">
            {inicial.length === 0 ? 'Crie um orçamento para um cliente e ele fica salvo aqui para consulta.' : 'Tente outro nome de cliente.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((o) => (
            <Link key={o.id} href={`/dashboard/orcamentos/${o.id}`}
              className="card-surface flex items-center justify-between gap-4 px-5 py-4 hover:bg-input transition-colors cursor-pointer">
              <div className="min-w-0">
                <p className="font-playfair text-primary text-[17px] font-semibold leading-tight truncate">{o.cliente_nome}</p>
                <p className="text-secondary text-xs mt-1">{formatData(o.created_at)} · validade {o.validade_dias} dias</p>
              </div>
              <span className="font-playfair text-accent-primary text-[20px] font-bold tabular-nums shrink-0">R$ {formatBRL(o.total)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
