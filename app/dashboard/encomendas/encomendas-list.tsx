'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ClipboardList, Plus, Search, CalendarClock } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { formatBRL, normalizeSearch } from '@/lib/format'
import { StatusBadgeEncomenda } from './components/status-badge-encomenda'
import type { EncomendaListItem, EncomendaStatus } from '@/app/actions/encomenda'

function fmtData(d: string) {
  // d = YYYY-MM-DD (sem timezone) → exibe DD/MM
  const [y, m, dd] = d.split('-')
  return `${dd}/${m}/${y}`
}
function fmtHora(h: string | null) {
  return h ? h.slice(0, 5) : null
}

const TABS: { value: EncomendaStatus | 'todas'; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_producao', label: 'Em produção' },
  { value: 'pronto', label: 'Pronto' },
  { value: 'entregue', label: 'Entregue' },
]

export function EncomendasList({ inicial }: { inicial: EncomendaListItem[] }) {
  const [busca, setBusca] = useState('')
  const [tab, setTab] = useState<EncomendaStatus | 'todas'>('todas')
  const [data, setData] = useState('')

  const filtrados = useMemo(() => {
    const t = normalizeSearch(busca)
    return inicial.filter((e) => {
      const mBusca = !t || normalizeSearch(e.cliente_nome).includes(t)
      const mTab = tab === 'todas' ? e.status !== 'cancelada' : e.status === tab
      const mData = !data || e.data_entrega === data
      return mBusca && mTab && mData
    })
  }, [inicial, busca, tab, data])

  return (
    <div>
      <PageTitle icon={ClipboardList} subtitle="Pedidos de clientes com prazo de entrega">Encomendas</PageTitle>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary/50 pointer-events-none" />
          <input type="text" placeholder="Buscar por cliente…" value={busca} onChange={(e) => setBusca(e.target.value)} className="input-field pl-10" />
        </div>
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="input-field sm:w-44" title="Filtrar por data de entrega" />
        <Link href="/dashboard/encomendas/nova" className="btn-primary shrink-0">
          <Plus size={16} />
          Nova encomenda
        </Link>
      </div>

      {/* Tabs de status */}
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
            <ClipboardList size={28} className="text-secondary/50" />
          </div>
          <p className="text-primary text-base font-playfair mb-1">{inicial.length === 0 ? 'Nenhuma encomenda ainda' : 'Nenhum resultado'}</p>
          <p className="text-secondary text-sm max-w-xs">{inicial.length === 0 ? 'Lance a primeira encomenda de um cliente e imprima a comanda pra produção.' : 'Ajuste os filtros.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((e) => (
            <Link key={e.id} href={`/dashboard/encomendas/${e.id}`}
              className="card-surface flex items-center justify-between gap-4 px-5 py-4 hover:bg-input transition-colors cursor-pointer">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-playfair text-primary text-[17px] font-semibold leading-tight truncate">{e.cliente_nome}</p>
                  <StatusBadgeEncomenda status={e.status} size="sm" />
                </div>
                <p className="text-secondary text-xs mt-1 flex items-center gap-1.5">
                  <CalendarClock size={12} className="text-accent-primary/70" />
                  Entrega {fmtData(e.data_entrega)}{fmtHora(e.hora_entrega) ? ` às ${fmtHora(e.hora_entrega)}` : ''}
                </p>
              </div>
              {e.com_valor && (
                <span className="font-playfair text-accent-primary text-[18px] font-bold tabular-nums shrink-0">R$ {formatBRL(e.total)}</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
