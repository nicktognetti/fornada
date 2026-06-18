'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, PackageCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { StatusBadgeTransferencia, StatusBadgeItem } from '../components/status-badge'
import { ConfirmacaoDrawer } from '../components/confirmacao-drawer'
import type { StatusTransferencia, StatusItem } from '../components/status-badge'

type Transferencia = {
  id: string
  codigo: string
  tipo: 'TRANSFERENCIA' | 'DEVOLUCAO'
  status: StatusTransferencia
  unidade_origem_id: string
  unidade_destino_id: string
  responsavel_origem_id: string
  responsavel_destino_id: string | null
  observacao: string | null
  created_at: string
  confirmed_at: string | null
}

type TransferenciaItem = {
  id: string
  produto_id: string
  quantidade_enviada: number
  quantidade_recebida: number | null
  status_item: StatusItem
  motivo_divergencia: string | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function TransferenciaDetalhePage() {
  const params  = useParams()
  const router  = useRouter()
  const id      = params.id as string

  const [transferencia, setTransferencia] = useState<Transferencia | null>(null)
  const [itens,         setItens]         = useState<TransferenciaItem[]>([])
  const [unidadeMap,    setUnidadeMap]    = useState<Map<string, string>>(new Map())
  const [produtoMap,    setProdutoMap]    = useState<Map<string, string>>(new Map())
  const [userId,        setUserId]        = useState<string | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [drawerOpen,    setDrawerOpen]    = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const [{ data: { user } }, tRes, iRes, uRes] = await Promise.all([
        supabase.auth.getUser(),
        supabase.schema('fornada').from('transferencia').select('*').eq('id', id).single(),
        supabase.schema('fornada').from('transferencia_item').select('*').eq('transferencia_id', id),
        supabase.from('unidade').select('id, nome'),
      ])

      setUserId(user?.id ?? null)
      setTransferencia(tRes.data as Transferencia | null)
      setItens((iRes.data ?? []) as TransferenciaItem[])
      setUnidadeMap(new Map((uRes.data ?? []).map((u) => [u.id, u.nome])))

      const prodIds = [...new Set((iRes.data ?? []).map((i: TransferenciaItem) => i.produto_id))]
      if (prodIds.length > 0) {
        const { data: prods } = await supabase.from('produto').select('id, nome').in('id', prodIds)
        setProdutoMap(new Map((prods ?? []).map((p) => [p.id, p.nome])))
      }

      setLoading(false)
    }
    load()
  }, [id])

  function handleConfirmSuccess() {
    setDrawerOpen(false)
    router.refresh()
    window.location.reload()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-[#888888] text-sm">
        Carregando...
      </div>
    )
  }

  if (!transferencia) {
    return (
      <div className="flex flex-col items-center py-24 gap-4">
        <p className="text-[#888888]">Transferência não encontrada.</p>
        <Link href="/dashboard/transferencias" className="text-[#d98d5f] text-sm hover:text-[#e8a57a]">
          ← Voltar
        </Link>
      </div>
    )
  }

  const podeConferir =
    transferencia.status === 'EM_TRANSITO' &&
    userId !== null &&
    userId !== transferencia.responsavel_origem_id

  const itensParaDrawer = itens.map((i) => ({
    id: i.id,
    produto_nome: produtoMap.get(i.produto_id) ?? i.produto_id,
    quantidade_enviada: i.quantidade_enviada,
  }))

  return (
    <div>
      {/* Breadcrumb */}
      <Link
        href="/dashboard/transferencias"
        className="inline-flex items-center gap-1.5 text-sm text-[#888888] hover:text-[#d98d5f] transition-colors mb-6"
      >
        <ArrowLeft size={15} />
        Transferências
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="font-playfair text-[#f5f5f0] text-[28px] font-bold tracking-tight">
              {transferencia.codigo}
            </h1>
            <StatusBadgeTransferencia status={transferencia.status} />
          </div>
          <p className="text-sm text-[#888888]">
            {transferencia.tipo === 'TRANSFERENCIA' ? 'Transferência de produtos' : 'Devolução de produtos'}
          </p>
        </div>

        {podeConferir && (
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#d98d5f] hover:bg-[#e8a57a] text-white text-sm font-semibold shadow-sm transition-colors shrink-0"
          >
            <PackageCheck size={15} />
            Confirmar recebimento
          </button>
        )}
      </div>

      {/* Informações */}
      <div className="bg-[#222226] border border-[#333336] rounded-lg shadow-lg shadow-black/20 p-6 mb-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#888888] mb-4">
          Informações
        </h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <dt className="text-xs text-[#888888] mb-0.5">Tipo</dt>
            <dd>
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1 ring-inset ${
                  transferencia.tipo === 'TRANSFERENCIA'
                    ? 'bg-[#2a2a1e] text-[#d9a05f] ring-[#d9a05f]/20'
                    : 'bg-[#2a2a2a] text-[#888888] ring-[#888888]/20'
                }`}
              >
                {transferencia.tipo === 'TRANSFERENCIA' ? 'Envio' : 'Devolução'}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[#888888] mb-0.5">Rota</dt>
            <dd className="flex items-center gap-1.5 text-sm">
              <span className="font-medium text-[#d4d4d0]">{unidadeMap.get(transferencia.unidade_origem_id) ?? '—'}</span>
              <ArrowRight size={12} className="text-[#d98d5f]/50 shrink-0" />
              <span className="font-medium text-[#d4d4d0]">{unidadeMap.get(transferencia.unidade_destino_id) ?? '—'}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[#888888] mb-0.5">Responsável origem</dt>
            <dd className="text-sm font-medium text-[#d4d4d0]">
              {transferencia.responsavel_origem_id === userId ? 'Você' : 'Outro operador'}
            </dd>
          </div>
          {transferencia.responsavel_destino_id && (
            <div>
              <dt className="text-xs text-[#888888] mb-0.5">Responsável recebimento</dt>
              <dd className="text-sm font-medium text-[#d4d4d0]">
                {transferencia.responsavel_destino_id === userId ? 'Você' : 'Outro operador'}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-[#888888] mb-0.5">Criada em</dt>
            <dd className="text-sm font-medium text-[#d4d4d0]">{formatDate(transferencia.created_at)}</dd>
          </div>
          {transferencia.confirmed_at && (
            <div>
              <dt className="text-xs text-[#888888] mb-0.5">Confirmada em</dt>
              <dd className="text-sm font-medium text-[#d4d4d0]">{formatDate(transferencia.confirmed_at)}</dd>
            </div>
          )}
          {transferencia.observacao && (
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-xs text-[#888888] mb-0.5">Observação</dt>
              <dd className="text-sm text-[#d4d4d0]">{transferencia.observacao}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Tabela de itens */}
      <div className="bg-[#222226] border border-[#333336] rounded-lg shadow-lg shadow-black/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-[#333336]">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#888888]">
            Itens ({itens.length})
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#222226] border-b border-[#333336]">
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#888888]">Produto</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[#888888]">Enviado</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[#888888] hidden sm:table-cell">Recebido</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#888888]">Status</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#888888] hidden md:table-cell">Divergência</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#333336]">
            {itens.map((item, i) => (
              <tr
                key={item.id}
                className={`transition-colors hover:bg-[#2a2a2e] ${i % 2 === 0 ? 'bg-[#1a1a1c]' : 'bg-[#1e1e22]'}`}
              >
                <td className="px-4 py-3 font-medium text-[#d4d4d0]">
                  {produtoMap.get(item.produto_id) ?? '—'}
                </td>
                <td className="px-4 py-3 text-right text-[#888888]">
                  {item.quantidade_enviada.toLocaleString('pt-BR')}
                </td>
                <td className="px-4 py-3 text-right text-[#888888] hidden sm:table-cell">
                  {item.quantidade_recebida !== null ? item.quantidade_recebida.toLocaleString('pt-BR') : '—'}
                </td>
                <td className="px-4 py-3">
                  <StatusBadgeItem status={item.status_item} />
                </td>
                <td className="px-4 py-3 text-xs text-[#888888] hidden md:table-cell max-w-[180px] truncate">
                  {item.motivo_divergencia ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Drawer de confirmação */}
      {drawerOpen && userId && (
        <ConfirmacaoDrawer
          transferenciaId={transferencia.id}
          userId={userId}
          itens={itensParaDrawer}
          onClose={() => setDrawerOpen(false)}
          onSuccess={handleConfirmSuccess}
        />
      )}
    </div>
  )
}
