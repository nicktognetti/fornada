'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, PackageCheck, TrendingDown, Loader2, CalendarDays, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL } from '@/lib/format'
import { ConfirmacaoDrawer } from '../../components/confirmacao-drawer'
import type { TransferenciaReceber, StatusFinanceiro } from '../types'

const STATUS_FIN_LABEL: Record<StatusFinanceiro, string> = {
  pendente:  'Pendente',
  a_receber: 'A Receber',
  recebido:  'Recebido',
  cancelado: 'Cancelado',
}

const STATUS_FIN_CLS: Record<StatusFinanceiro, string> = {
  pendente:  'bg-neutral-tint text-secondary ring-secondary/20',
  a_receber: 'bg-accent-tint text-accent-primary ring-accent-primary/20',
  recebido:  'bg-success-tint text-success ring-success/20',
  cancelado: 'bg-danger-tint text-danger ring-danger/20',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

type ItemDrawer = {
  id: string
  produto_nome: string
  quantidade_enviada: number
  preco_unitario: number
}

interface Props {
  transferencias: TransferenciaReceber[]
  totalAReceber: number
  isCentro: boolean
  userId: string
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

export function TransferenciasTab({ transferencias, totalAReceber, isCentro, userId }: Props) {
  const router = useRouter()
  const [drawerTransferencia, setDrawerTransferencia] = useState<TransferenciaReceber | null>(null)
  const [drawerItens,         setDrawerItens]         = useState<ItemDrawer[]>([])
  const [loadingId,           setLoadingId]           = useState<string | null>(null)
  const [dataFiltro, setDataFiltro] = useState<string>(todayISO)

  const visiveis = dataFiltro
    ? transferencias.filter((t) => t.created_at.startsWith(dataFiltro))
    : transferencias

  async function abrirConfirmar(t: TransferenciaReceber) {
    setLoadingId(t.id)
    const supabase = createClient()

    const { data: itensRaw } = await supabase
      .from('transferencia_item')
      .select('id, produto_id, quantidade_enviada, preco_unitario')
      .eq('transferencia_id', t.id)

    const prodIds = (itensRaw ?? []).map((i: { produto_id: string }) => i.produto_id)
    const { data: produtos } = prodIds.length > 0
      ? await supabase.from('produto').select('id, nome').in('id', prodIds)
      : { data: [] }

    const prodMap = new Map((produtos ?? []).map((p: { id: string; nome: string }) => [p.id, p.nome]))

    setDrawerItens((itensRaw ?? []).map((i: {
      id: string; produto_id: string; quantidade_enviada: number; preco_unitario: number
    }) => ({
      id: i.id,
      produto_nome: prodMap.get(i.produto_id) ?? '—',
      quantidade_enviada: i.quantidade_enviada,
      preco_unitario: i.preco_unitario,
    })))

    setDrawerTransferencia(t)
    setLoadingId(null)
  }

  return (
    <div className="space-y-4">
      {/* Filtro de data */}
      <div className="flex items-center gap-2">
        <CalendarDays size={14} className="text-secondary shrink-0" />
        <input
          type="date"
          value={dataFiltro}
          onChange={(e) => setDataFiltro(e.target.value)}
          className="bg-input border border-subtle rounded-lg px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/40 focus:border-accent-primary transition-colors"
        />
        {dataFiltro && (
          <button
            onClick={() => setDataFiltro('')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-secondary hover:text-ink-soft hover:bg-input border border-subtle transition-colors"
          >
            <X size={11} />
            Todos
          </button>
        )}
        <span className="text-xs text-faint ml-1">
          {dataFiltro ? `${visiveis.length} de ${transferencias.length}` : `${transferencias.length} total`}
        </span>
      </div>

      {visiveis.length === 0 ? (
        <div className="bg-surface border border-subtle rounded-lg shadow-lg shadow-black/20 flex flex-col items-center py-16 text-center">
          <PackageCheck size={40} className="mb-4 text-accent-primary/25" />
          <p className="font-medium text-primary text-base">
            {dataFiltro ? 'Nenhuma transferência nessa data' : 'Nenhuma transferência a receber'}
          </p>
          <p className="text-sm text-secondary mt-1">
            {dataFiltro ? 'Tente outra data ou clique em "Todos".' : 'Todas as transferências foram conferidas.'}
          </p>
        </div>
      ) : (
      <div className="bg-surface border border-subtle rounded-lg shadow-lg shadow-black/20 overflow-hidden">
        {/* Cabeçalho */}
        <div className="hidden sm:grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-subtle bg-canvas">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Data / Código</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Origem</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary text-center w-16">Itens</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary text-right w-28">Valor Total</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary w-36"></span>
        </div>

        <div className="divide-y divide-subtle">
          {visiveis.map((t) => {
            const sfin = t.status_financeiro ?? 'pendente'
            const carregando = loadingId === t.id
            return (
              <div
                key={t.id}
                className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto_auto] items-center gap-3 px-5 py-4 hover:bg-input transition-colors"
              >
                {/* Data + código */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-primary">{t.codigo}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ring-inset ${STATUS_FIN_CLS[sfin]}`}>
                      {STATUS_FIN_LABEL[sfin]}
                    </span>
                  </div>
                  <p className="text-xs text-secondary mt-0.5">{formatDate(t.created_at)}</p>
                </div>

                {/* Origem */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm font-medium text-ink-soft truncate">{t.unidade_origem_nome}</span>
                  <ArrowRight size={11} className="text-accent-primary/40 shrink-0" />
                  <span className="text-xs text-secondary truncate">Esta unidade</span>
                </div>

                {/* Qtd itens */}
                <div className="hidden sm:flex items-center justify-center w-16">
                  <span className="text-sm text-secondary tabular-nums">
                    {t.total_itens} {t.total_itens === 1 ? 'item' : 'itens'}
                  </span>
                </div>

                {/* Valor total */}
                <div className="hidden sm:flex justify-end w-28">
                  {t.valor_total > 0 ? (
                    <span className="text-sm font-semibold text-primary tabular-nums">
                      R$ {formatBRL(t.valor_total)}
                    </span>
                  ) : (
                    <span className="text-xs text-faint">—</span>
                  )}
                </div>

                {/* Ações */}
                <div className="flex items-center justify-end gap-2 w-36">
                  <Link
                    href={`/dashboard/transferencias/${t.id}`}
                    className="px-3 py-1.5 rounded-lg border border-subtle text-secondary hover:text-ink-soft hover:bg-input text-xs font-medium transition-colors"
                  >
                    Ver
                  </Link>
                  <button
                    onClick={() => abrirConfirmar(t)}
                    disabled={carregando}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-primary hover:bg-accent-hover text-accent-ink text-xs font-semibold shadow-sm transition-colors disabled:opacity-60"
                  >
                    {carregando
                      ? <Loader2 size={12} className="animate-spin" />
                      : <PackageCheck size={12} />
                    }
                    Confirmar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      )}

      {/* Card resumo financeiro — só para Centro */}
      {isCentro && totalAReceber > 0 && (
        <div className="bg-surface border border-subtle rounded-lg shadow-lg shadow-black/20 p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-tint flex items-center justify-center shrink-0">
              <TrendingDown size={18} className="text-accent-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-secondary">Total a receber</p>
              <p className="text-xs text-secondary mt-0.5">Soma das transferências com status financeiro &quot;a receber&quot;</p>
            </div>
          </div>
          <p className="font-playfair text-2xl font-bold text-primary tabular-nums shrink-0">
            R$ {formatBRL(totalAReceber)}
          </p>
        </div>
      )}

      {/* Drawer de confirmação */}
      {drawerTransferencia && (
        <ConfirmacaoDrawer
          transferenciaId={drawerTransferencia.id}
          userId={userId}
          itens={drawerItens}
          onClose={() => setDrawerTransferencia(null)}
          onSuccess={() => {
            setDrawerTransferencia(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
