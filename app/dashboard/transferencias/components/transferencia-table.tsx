'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Eye, ArrowLeftRight } from 'lucide-react'
import { StatusBadgeTransferencia } from './status-badge'
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

type FilterTab = 'todas' | 'em_transito' | 'recebidas' | 'divergencia'

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'todas',       label: 'Todas' },
  { key: 'em_transito', label: 'Em Trânsito' },
  { key: 'recebidas',   label: 'Recebidas' },
  { key: 'divergencia', label: 'Com Divergência' },
]

const STATUS_FILTER: Record<FilterTab, StatusTransferencia[]> = {
  todas:       ['PENDENTE', 'EM_TRANSITO', 'RECEBIDO', 'RECEBIDO_COM_DIVERGENCIA'],
  em_transito: ['EM_TRANSITO'],
  recebidas:   ['RECEBIDO'],
  divergencia: ['RECEBIDO_COM_DIVERGENCIA'],
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export function TransferenciaTable({
  rows,
  sucesso,
}: {
  rows: TransferenciaRow[]
  sucesso?: string | null
}) {
  const [tab, setTab] = useState<FilterTab>('todas')
  const [banner, setBanner] = useState(sucesso ?? null)

  const filtered = rows.filter((r) => STATUS_FILTER[tab].includes(r.status))

  return (
    <div>
      {/* Banner de sucesso */}
      {banner && (
        <div className="mb-6 flex items-center justify-between gap-4 bg-[#dcfce7] border border-[#166534]/20 text-[#166534] rounded-xl px-4 py-3 text-sm font-medium">
          <span>Transferência {banner} criada com sucesso.</span>
          <button
            onClick={() => setBanner(null)}
            className="text-[#166534]/60 hover:text-[#166534] text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* Tabs — underline style */}
      <div className="flex border-b border-[#e5ddd3] mb-5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 pb-3 pt-1 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? 'border-[#c2410c] text-[#c2410c] font-semibold'
                : 'border-transparent text-[#78716c] hover:text-[#44403c]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div className="bg-white border border-[#e5ddd3] rounded-lg shadow-md overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#78716c]">
            <ArrowLeftRight size={32} className="mb-3 text-[#c2410c]/30" />
            <p className="font-medium text-[#1c1917]">Nenhuma transferência encontrada</p>
            <p className="text-sm mt-1">Crie uma nova transferência para começar.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#faf7f4] border-b border-[#e5ddd3]">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#78716c]">
                  Código
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#78716c]">
                  Tipo
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#78716c] hidden sm:table-cell">
                  Rota
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#78716c]">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#78716c] hidden md:table-cell">
                  Data
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5ddd3]">
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  className="bg-white hover:bg-[#faf7f4] transition-colors"
                >
                  <td className="px-4 py-3.5 font-mono text-[13px] font-semibold text-[#1c1917]">
                    {row.codigo}
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                        row.tipo === 'TRANSFERENCIA'
                          ? 'bg-[#fff7ed] text-[#9a3412]'
                          : 'bg-[#f3f4f6] text-[#44403c]'
                      }`}
                    >
                      {row.tipo === 'TRANSFERENCIA' ? 'Envio' : 'Devolução'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 hidden sm:table-cell">
                    <span className="flex items-center gap-1.5 text-xs">
                      <span className="font-medium text-[#1c1917]">{row.unidade_origem_nome}</span>
                      <ArrowRight size={12} className="shrink-0 text-[#c2410c]/40" />
                      <span className="font-medium text-[#1c1917]">{row.unidade_destino_nome}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadgeTransferencia status={row.status} />
                  </td>
                  <td className="px-4 py-3.5 text-xs text-[#78716c] hidden md:table-cell">
                    {formatDate(row.created_at)}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <Link
                      href={`/dashboard/transferencias/${row.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-[#78716c] hover:text-[#c2410c] hover:bg-[#fff7ed] transition-all"
                    >
                      <Eye size={13} />
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
