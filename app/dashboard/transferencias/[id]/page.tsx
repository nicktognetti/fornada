import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatBRL } from '@/lib/format'
import { temAcesso } from '@/app/lib/authz'
import { StatusBadgeTransferencia, StatusBadgeItem } from '../components/status-badge'
import { AcoesTransferencia } from '../components/acoes-transferencia'
import { TransferenciaPrint } from '../components/transferencia-print'
import type { StatusTransferencia, StatusItem } from '../components/status-badge'

type StatusFinanceiro = 'pendente' | 'a_receber' | 'recebido' | 'cancelado'

const STATUS_FIN_LABEL: Record<StatusFinanceiro, string> = {
  pendente:  'Pendente',
  a_receber: 'A receber',
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
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default async function TransferenciaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  // Carregar dados em paralelo (check admin junto para evitar round-trip extra)
  const [tRes, iRes, uRes, vinculosRes, isAdmin] = await Promise.all([
    supabase.from('transferencia').select('*').eq('id', id).single(),
    supabase.from('transferencia_item').select('*').eq('transferencia_id', id),
    supabase.from('unidade').select('id, nome'),
    supabase.from('usuario_unidade').select('unidade_id').eq('user_id', user.id),
    temAcesso(user.id, ['transferencias'], { nivel: 'admin' }),
  ])

  if (!tRes.data) notFound()

  type TRow = {
    id: string; codigo: string; tipo: 'TRANSFERENCIA' | 'DEVOLUCAO'
    status: StatusTransferencia; status_financeiro: StatusFinanceiro | null
    valor_total: number; unidade_origem_id: string; unidade_destino_id: string
    responsavel_origem_id: string; responsavel_destino_id: string | null
    observacao: string | null; created_at: string; confirmed_at: string | null
    empresa_id: string
  }

  type IRow = {
    id: string; produto_id: string; quantidade_enviada: number
    quantidade_recebida: number | null; preco_unitario: number
    subtotal: number; status_item: StatusItem; motivo_divergencia: string | null
  }

  const transferencia = tRes.data as TRow
  const itens = (iRes.data ?? []) as IRow[]
  const unidadeMap = new Map((uRes.data ?? []).map((u) => [u.id, u.nome]))
  const vinculosData = vinculosRes.data ?? []
  const minhasUnidades = vinculosData.map((v: { unidade_id: string }) => v.unidade_id)

  // Se usuario_unidade está vazio (migration 009 não rodou ou admin não configurou),
  // assume acesso a todas as unidades da empresa como fallback permissivo.
  const todasUnidadesIds = (uRes.data ?? []).map((u) => u.id)
  const unidadesEfetivas = minhasUnidades.length > 0 ? minhasUnidades : todasUnidadesIds

  // Buscar nomes dos produtos
  const prodIds = [...new Set(itens.map((i) => i.produto_id))]
  const produtoMap = new Map<string, string>()
  if (prodIds.length > 0) {
    const { data: prods } = await supabase.from('produto').select('id, nome').in('id', prodIds)
    for (const p of prods ?? []) produtoMap.set(p.id, p.nome)
  }

  // Calcular permissões server-side — sem risco de race condition client
  const podeConferir =
    ['EM_TRANSITO', 'PENDENTE'].includes(transferencia.status) &&
    unidadesEfetivas.includes(transferencia.unidade_destino_id)

  const podeCancelar = ['PENDENTE', 'EM_TRANSITO'].includes(transferencia.status)
  const podeExcluir  = ['PENDENTE', 'CANCELADA'].includes(transferencia.status)

  const statusFin = transferencia.status_financeiro ?? 'pendente'

  const itensParaAcoes = itens.map((i) => ({
    id: i.id,
    produto_nome: produtoMap.get(i.produto_id) ?? '—',
    quantidade_enviada: i.quantidade_enviada,
    preco_unitario: i.preco_unitario,
  }))

  return (
    <div>
      {/* Breadcrumb */}
      <Link
        href="/dashboard/transferencias"
        className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-accent-primary transition-colors mb-6"
      >
        <ArrowLeft size={15} />
        Transferências
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="font-playfair text-primary text-[28px] font-bold tracking-tight">
              {transferencia.codigo}
            </h1>
            <StatusBadgeTransferencia status={transferencia.status} />
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1 ring-inset ${STATUS_FIN_CLS[statusFin]}`}>
              {STATUS_FIN_LABEL[statusFin]}
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm text-secondary">
              {transferencia.tipo === 'TRANSFERENCIA' ? 'Transferência de produtos' : 'Devolução de produtos'}
            </p>
            {isAdmin && transferencia.valor_total > 0 && (
              <span className="text-sm font-semibold text-primary tabular-nums">
                R$ {formatBRL(transferencia.valor_total)}
              </span>
            )}
          </div>
        </div>

        {/* Botões de ação + impressão — Client Components */}
        <div className="flex items-center gap-2 flex-wrap">
          <TransferenciaPrint
            codigo={transferencia.codigo}
            tipoLabel={transferencia.tipo === 'TRANSFERENCIA' ? 'Transferência' : 'Devolução'}
            origem={unidadeMap.get(transferencia.unidade_origem_id) ?? '—'}
            destino={unidadeMap.get(transferencia.unidade_destino_id) ?? '—'}
            criadaEm={formatDate(transferencia.created_at)}
            observacao={transferencia.observacao}
            itens={itens.map((i) => ({
              nome: produtoMap.get(i.produto_id) ?? '—',
              enviada: i.quantidade_enviada,
              recebida: i.quantidade_recebida,
              preco: i.preco_unitario,
            }))}
            isAdmin={isAdmin}
            valorTotal={transferencia.valor_total}
          />
          <AcoesTransferencia
            transferenciaId={id}
            userId={user.id}
            podeConferir={podeConferir}
            podeCancelar={podeCancelar}
            podeExcluir={podeExcluir}
            itens={itensParaAcoes}
            isAdmin={isAdmin}
          />
        </div>
      </div>

      {/* Informações */}
      <div className="bg-surface border border-subtle rounded-lg shadow-lg shadow-black/20 p-6 mb-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-secondary mb-4">
          Informações
        </h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <dt className="text-xs text-secondary mb-0.5">Tipo</dt>
            <dd>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1 ring-inset ${
                transferencia.tipo === 'TRANSFERENCIA'
                  ? 'bg-accent-tint text-accent-primary ring-accent-primary/20'
                  : 'bg-neutral-tint text-secondary ring-secondary/20'
              }`}>
                {transferencia.tipo === 'TRANSFERENCIA' ? 'Envio' : 'Devolução'}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-secondary mb-0.5">Rota</dt>
            <dd className="flex items-center gap-1.5 text-sm">
              <span className="font-medium text-ink-soft">{unidadeMap.get(transferencia.unidade_origem_id) ?? '—'}</span>
              <ArrowRight size={12} className="text-accent-primary/50 shrink-0" />
              <span className="font-medium text-ink-soft">{unidadeMap.get(transferencia.unidade_destino_id) ?? '—'}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-secondary mb-0.5">Responsável origem</dt>
            <dd className="text-sm font-medium text-ink-soft">
              {transferencia.responsavel_origem_id === user.id ? 'Você' : 'Outro operador'}
            </dd>
          </div>
          {transferencia.responsavel_destino_id && (
            <div>
              <dt className="text-xs text-secondary mb-0.5">Responsável recebimento</dt>
              <dd className="text-sm font-medium text-ink-soft">
                {transferencia.responsavel_destino_id === user.id ? 'Você' : 'Outro operador'}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-secondary mb-0.5">Criada em</dt>
            <dd className="text-sm font-medium text-ink-soft">{formatDate(transferencia.created_at)}</dd>
          </div>
          {transferencia.confirmed_at && (
            <div>
              <dt className="text-xs text-secondary mb-0.5">Confirmada em</dt>
              <dd className="text-sm font-medium text-ink-soft">{formatDate(transferencia.confirmed_at)}</dd>
            </div>
          )}
          {transferencia.observacao && (
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-xs text-secondary mb-0.5">Observação</dt>
              <dd className="text-sm text-ink-soft">{transferencia.observacao}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Tabela de itens */}
      <div className="bg-surface border border-subtle rounded-lg shadow-lg shadow-black/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-subtle">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-secondary">
            Itens ({itens.length})
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface border-b border-subtle">
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-secondary">Produto</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-secondary">Enviado</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-secondary hidden sm:table-cell">Recebido</th>
              {isAdmin && <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-secondary hidden md:table-cell">Preço unit.</th>}
              {isAdmin && <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-secondary hidden md:table-cell">Subtotal</th>}
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-secondary">Status</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-secondary hidden lg:table-cell">Divergência</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {itens.map((item, i) => (
              <tr
                key={item.id}
                className={`transition-colors hover:bg-input ${i % 2 === 0 ? 'bg-canvas' : 'bg-surface-2'}`}
              >
                <td className="px-4 py-3 font-medium text-ink-soft">
                  {produtoMap.get(item.produto_id) ?? '—'}
                </td>
                <td className="px-4 py-3 text-right text-secondary tabular-nums">
                  {item.quantidade_enviada.toLocaleString('pt-BR')}
                </td>
                <td className="px-4 py-3 text-right text-secondary tabular-nums hidden sm:table-cell">
                  {item.quantidade_recebida !== null ? item.quantidade_recebida.toLocaleString('pt-BR') : '—'}
                </td>
                {isAdmin && (
                  <td className="px-4 py-3 text-right text-secondary tabular-nums hidden md:table-cell">
                    R$ {formatBRL(item.preco_unitario ?? 0)}
                  </td>
                )}
                {isAdmin && (
                  <td className="px-4 py-3 text-right font-medium text-primary tabular-nums hidden md:table-cell">
                    R$ {formatBRL(item.subtotal ?? item.quantidade_enviada * (item.preco_unitario ?? 0))}
                  </td>
                )}
                <td className="px-4 py-3">
                  <StatusBadgeItem status={item.status_item} />
                </td>
                <td className="px-4 py-3 text-xs text-secondary hidden lg:table-cell max-w-[180px] truncate">
                  {item.motivo_divergencia ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {isAdmin && transferencia.valor_total > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-subtle bg-canvas">
            <span className="text-xs font-semibold uppercase tracking-wider text-secondary">Valor total</span>
            <span className="font-playfair text-xl font-bold text-primary tabular-nums">
              R$ {formatBRL(transferencia.valor_total)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
