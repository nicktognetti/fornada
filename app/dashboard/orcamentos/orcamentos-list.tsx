'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { FileText, Plus, Search } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { formatBRL, normalizeSearch } from '@/lib/format'
import { StatusBadgeOrcamento } from './components/status-badge-orcamento'
import type { OrcamentoListItem, OrcamentoStatus } from '@/app/actions/orcamento'

function formatData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const TABS: { value: OrcamentoStatus | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'aguardando', label: 'Aguardando' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'recusado', label: 'Recusado' },
]

export function OrcamentosList({ inicial }: { inicial: OrcamentoListItem[] }) {
  const [busca, setBusca] = useState('')
  const [tab, setTab] = useState<OrcamentoStatus | 'todos'>('todos')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')

  const filtrados = useMemo(() => {
    const t = normalizeSearch(busca)
    return inicial.filter((o) => {
      const dia = o.created_at.slice(0, 10)
      const mBusca = !t || normalizeSearch(o.cliente_nome).includes(t)
      const mTab = tab === 'todos' || o.status === tab
      const mDe = !de || dia >= de
      const mAte = !ate || dia <= ate
      return mBusca && mTab && mDe && mAte
    })
  }, [inicial, busca, tab, de, ate])

  return (
    <div>
      <PageTitle icon={FileText} subtitle="Orçamentos para clientes">Orçamentos</PageTitle>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary/50 pointer-events-none" />
          <input type="text" placeholder="Buscar por cliente…" value={busca} onChange={(e) => setBusca(e.target.value)} className="input-field pl-10" />
        </div>
        <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="input-field sm:w-40" title="De" />
        <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="input-field sm:w-40" title="Até" />
        <Link href="/dashboard/orcamentos/novo" className="btn-primary shrink-0">
          <Plus size={16} />
          Novo orçamento
        </Link>
      </div>

      <div className="flex items-center gap-1 bg-input rounded-xl p-1 mb-6 w-fit flex-wrap">
        {TABS.map((t) => (
          <button key={t.value} onClick={() => setTab(t.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t.value ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}>
            {t.label}
          </button>
        ))}
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
            {inicial.length === 0 ? 'Crie um orçamento para um cliente e ele fica salvo aqui para consulta.' : 'Ajuste os filtros.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((o) => (
            <Link key={o.id} href={`/dashboard/orcamentos/${o.id}`}
              className="card-surface flex items-center justify-between gap-4 px-5 py-4 hover:bg-input transition-colors cursor-pointer">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-secondary text-xs tabular-nums">Nº {o.numero}</span>
                  <p className="font-playfair text-primary text-[17px] font-semibold leading-tight truncate">{o.cliente_nome}</p>
                  <StatusBadgeOrcamento status={o.status} size="sm" />
                </div>
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
