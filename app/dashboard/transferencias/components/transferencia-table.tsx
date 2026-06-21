'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Eye, ArrowLeftRight, Trash2, Loader2 } from 'lucide-react'
import { StatusBadgeTransferencia } from './status-badge'
import { excluirTransferenciaAction } from '@/app/actions/transferencia'
import type { StatusTransferencia } from './status-badge'

export type TransferenciaRow = {
  id: string
  codigo: string
  tipo: 'TRANSFERENCIA' | 'DEVOLUCAO'
  status: StatusTransferencia
  unidade_origem_nome: string
  unidade_destino_nome: string
  responsavel_email: string
  created_at: string
}

type FilterTab = 'todas' | 'em_transito' | 'recebidas' | 'divergencia' | 'canceladas'

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'todas',       label: 'Todas' },
  { key: 'em_transito', label: 'Em Trânsito' },
  { key: 'recebidas',   label: 'Recebidas' },
  { key: 'divergencia', label: 'Com Divergência' },
  { key: 'canceladas',  label: 'Canceladas' },
]

const STATUS_FILTER: Record<FilterTab, StatusTransferencia[]> = {
  todas:       ['PENDENTE', 'EM_TRANSITO', 'RECEBIDO', 'RECEBIDO_COM_DIVERGENCIA', 'CANCELADA'],
  em_transito: ['EM_TRANSITO', 'PENDENTE'],
  recebidas:   ['RECEBIDO'],
  divergencia: ['RECEBIDO_COM_DIVERGENCIA'],
  canceladas:  ['CANCELADA'],
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

// Modal de confirmação de exclusão inline
function ExcluirModal({
  codigo, loading, onClose, onConfirm,
}: { codigo: string; loading: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm bg-surface border border-subtle rounded-xl shadow-2xl shadow-black/40 p-6 space-y-4">
        <p className="text-base font-semibold text-primary">Excluir {codigo}</p>
        <p className="text-sm text-secondary">
          Tem certeza? Todos os itens serão removidos permanentemente. Esta ação não pode ser desfeita.
        </p>
        <div className="flex gap-3 justify-end pt-1">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg border border-subtle text-ink-soft hover:bg-input text-sm font-medium transition-colors"
          >
            Voltar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-danger hover:bg-danger/90 text-white text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Excluir
          </button>
        </div>
      </div>
    </div>
  )
}

export function TransferenciaTable({
  rows,
  sucesso,
}: {
  rows: TransferenciaRow[]
  sucesso?: string | null
}) {
  const router = useRouter()
  const [tab,    setTab]    = useState<FilterTab>('todas')
  const [banner, setBanner] = useState(sucesso ?? null)
  const [excluindoId,  setExcluindoId]  = useState<string | null>(null)
  const [excluirLoading, setExcluirLoading] = useState(false)

  const filtered = rows.filter((r) => STATUS_FILTER[tab].includes(r.status))

  async function handleExcluir(id: string) {
    setExcluirLoading(true)
    await excluirTransferenciaAction(id)
    setExcluirLoading(false)
    setExcluindoId(null)
    router.refresh()
  }

  const excluindoRow = rows.find((r) => r.id === excluindoId)

  return (
    <div>
      {/* Banner de sucesso */}
      {banner && (
        <div className="mb-6 flex items-center justify-between gap-4 bg-success-tint border border-success/30 text-success rounded-lg px-4 py-3 text-sm font-medium">
          <span>Transferência {banner} criada com sucesso.</span>
          <button onClick={() => setBanner(null)} className="text-success/60 hover:text-success text-lg leading-none">×</button>
        </div>
      )}

      {/* Tabs — underline style */}
      <div className="flex border-b border-subtle mb-5 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 pb-3 pt-1 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
              tab === t.key
                ? 'border-accent-primary text-accent-primary font-semibold'
                : 'border-transparent text-secondary hover:text-ink-soft'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div className="bg-surface border border-subtle rounded-lg shadow-lg shadow-black/20 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-secondary">
            <ArrowLeftRight size={32} className="mb-3 text-accent-primary/30" />
            <p className="font-medium text-primary">Nenhuma transferência encontrada</p>
            <p className="text-sm mt-1">Crie uma nova transferência para começar.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface border-b border-subtle">
                {['Código', 'Tipo', 'Rota', 'Status', 'Data', ''].map((h, i) => (
                  <th
                    key={i}
                    className={`px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-secondary ${
                      i === 2 ? 'hidden sm:table-cell' : i === 4 ? 'hidden md:table-cell' : ''
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {filtered.map((row, i) => {
                const podeExcluir = ['PENDENTE', 'CANCELADA'].includes(row.status)
                return (
                  <tr
                    key={row.id}
                    className={`transition-colors hover:bg-input ${i % 2 === 0 ? 'bg-canvas' : 'bg-surface-2'}`}
                  >
                    <td className="px-4 py-3.5 font-mono text-[13px] font-semibold text-primary">
                      {row.codigo}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                        row.tipo === 'TRANSFERENCIA'
                          ? 'bg-accent-tint text-accent-primary'
                          : 'bg-neutral-tint text-secondary'
                      }`}>
                        {row.tipo === 'TRANSFERENCIA' ? 'Envio' : 'Devolução'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 hidden sm:table-cell">
                      <span className="flex items-center gap-1.5 text-xs">
                        <span className="font-medium text-ink-soft">{row.unidade_origem_nome}</span>
                        <ArrowRight size={12} className="shrink-0 text-accent-primary/50" />
                        <span className="font-medium text-ink-soft">{row.unidade_destino_nome}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadgeTransferencia status={row.status} />
                    </td>
                    <td className="px-4 py-3.5 text-xs text-secondary hidden md:table-cell">
                      {formatDate(row.created_at)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {podeExcluir && (
                          <button
                            onClick={() => setExcluindoId(row.id)}
                            className="p-1.5 rounded-lg text-secondary hover:text-danger hover:bg-danger-tint transition-all"
                            title="Excluir"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                        <Link
                          href={`/dashboard/transferencias/${row.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-secondary hover:text-accent-primary hover:bg-accent-tint transition-all"
                        >
                          <Eye size={13} />
                          Ver
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal excluir */}
      {excluindoId && excluindoRow && (
        <ExcluirModal
          codigo={excluindoRow.codigo}
          loading={excluirLoading}
          onClose={() => setExcluindoId(null)}
          onConfirm={() => handleExcluir(excluindoId)}
        />
      )}
    </div>
  )
}
