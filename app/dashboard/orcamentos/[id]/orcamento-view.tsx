'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Trash2, CheckCircle2, XCircle, Clock, Loader2, Pencil } from 'lucide-react'
import { formatBRL } from '@/lib/format'
import { DocumentoImpressao, BotaoImprimir, tabelaImpressao as T } from '@/app/components/ui/documento-impressao'
import { excluirOrcamento, atualizarStatusOrcamento, type OrcamentoDetalhe, type OrcamentoStatus } from '@/app/actions/orcamento'
import { StatusBadgeOrcamento } from '../components/status-badge-orcamento'
import { statusExibicao } from '@/lib/orcamento-status'

function formatData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function OrcamentoView({ orcamento: o }: { orcamento: OrcamentoDetalhe }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [busy, setBusy] = useState(false)

  async function mudarStatus(status: OrcamentoStatus) {
    setBusy(true)
    await atualizarStatusOrcamento(o.id, status)
    setBusy(false)
    router.refresh()
  }

  async function excluir() {
    setExcluindo(true)
    await excluirOrcamento(o.id)
    router.push('/dashboard/orcamentos')
  }

  return (
    <>
      {/* Cabeçalho */}
      <div className="card-surface px-6 py-5 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-secondary text-xs mb-1 tabular-nums">Orçamento Nº {o.numero}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-playfair text-primary text-[28px] font-bold leading-tight">{o.cliente_nome}</h1>
              <StatusBadgeOrcamento status={statusExibicao(o.status, o.created_at, o.validade_dias)} />
            </div>
            <p className="text-secondary text-sm mt-1">
              {formatData(o.created_at)} · validade {o.validade_dias} dias{o.cliente_contato ? ` · ${o.cliente_contato}` : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="field-label mb-1">Total</p>
            <p className="font-playfair text-accent-primary text-[30px] font-bold leading-none tabular-nums">R$ {formatBRL(o.total)}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-5 pt-4 border-t border-subtle flex-wrap items-center">
          {o.status === 'aguardando' ? (
            <>
              <button onClick={() => mudarStatus('aprovado')} disabled={busy} className="btn-primary text-xs px-4 py-2 min-h-[36px] disabled:opacity-50">
                {busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Aprovar
              </button>
              <button onClick={() => mudarStatus('recusado')} disabled={busy} className="btn-ghost text-xs px-4 py-2 min-h-[36px] text-secondary hover:text-primary">
                <XCircle size={13} /> Recusar
              </button>
            </>
          ) : (
            <button onClick={() => mudarStatus('aguardando')} disabled={busy} className="btn-ghost text-xs px-4 py-2 min-h-[36px] text-secondary hover:text-primary">
              <Clock size={13} /> Reabrir
            </button>
          )}
          <BotaoImprimir label="Imprimir orçamento" className="text-xs px-4 py-2" />
          <Link href={`/dashboard/orcamentos/${o.id}/editar`} className="btn-ghost text-xs px-4 py-2 min-h-[36px] text-secondary hover:text-primary inline-flex items-center gap-1">
            <Pencil size={13} /> Editar
          </Link>
          {!confirm ? (
            <button onClick={() => setConfirm(true)} className="btn-ghost text-xs px-4 py-2 min-h-[36px] border-red-500/20 text-red-400/70 hover:text-red-400 hover:border-red-500/40 ml-auto">
              <Trash2 size={13} /> Excluir
            </button>
          ) : (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-red-400 text-xs">Excluir orçamento?</span>
              <button onClick={excluir} disabled={excluindo} className="text-xs text-red-400 border border-red-500/30 hover:bg-red-500/10 rounded-lg px-3 py-1.5">
                {excluindo ? 'Excluindo…' : 'Sim'}
              </button>
              <button onClick={() => setConfirm(false)} className="text-xs text-secondary hover:text-primary px-2 py-1.5">Não</button>
            </div>
          )}
        </div>
      </div>

      {/* Itens (tela) */}
      <div className="card-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-input text-secondary text-[11px] uppercase tracking-wider">
              <th className="text-left px-5 py-2.5 font-semibold">Item</th>
              <th className="text-right px-4 py-2.5 font-semibold">Qtd</th>
              <th className="text-right px-4 py-2.5 font-semibold">Preço un.</th>
              <th className="text-right px-5 py-2.5 font-semibold">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {o.itens.map((it) => (
              <tr key={it.id}>
                <td className="px-5 py-3 text-primary">{it.descricao}</td>
                <td className="px-4 py-3 text-right text-secondary tabular-nums">{it.quantidade}{it.unidade ? ` ${it.unidade}` : ''}</td>
                <td className="px-4 py-3 text-right text-secondary tabular-nums">R$ {formatBRL(it.preco_unitario)}{it.unidade ? `/${it.unidade}` : ''}</td>
                <td className="px-5 py-3 text-right font-medium text-primary tabular-nums">R$ {formatBRL(it.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {o.observacao && <p className="px-5 py-3 text-xs text-secondary border-t border-subtle">Obs.: {o.observacao}</p>}
      </div>

      {/* Documento de impressão */}
      <DocumentoImpressao titulo="Orçamento" numero={o.numero} subtitulo={`Cliente: ${o.cliente_nome}${o.cliente_contato ? ` · ${o.cliente_contato}` : ''}`} unidade={o.unidade_nome} assinaturas={['Responsável', 'Cliente']}>
        <table style={T.table}>
          <thead>
            <tr>
              <th style={T.th}>Item</th>
              <th style={T.thRight}>Qtd</th>
              <th style={T.thRight}>Preço un.</th>
              <th style={T.thRight}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {o.itens.map((it) => (
              <tr key={it.id}>
                <td style={T.td}>{it.descricao}</td>
                <td style={T.tdRight}>{it.quantidade}{it.unidade ? ` ${it.unidade}` : ''}</td>
                <td style={T.tdRight}>R$ {formatBRL(it.preco_unitario)}{it.unidade ? `/${it.unidade}` : ''}</td>
                <td style={T.tdRight}>R$ {formatBRL(it.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '8px', borderTop: '2px solid #1a1a1a', fontWeight: 700, fontSize: '15px' }}>
          <span>Total</span>
          <span>R$ {formatBRL(o.total)}</span>
        </div>
        <p style={{ marginTop: '10px', fontSize: '11px', color: '#555' }}>Validade: {o.validade_dias} dias a partir de {formatData(o.created_at)}.</p>
        {o.observacao && <p style={{ marginTop: '6px', fontSize: '11px', color: '#555' }}>Obs.: {o.observacao}</p>}
      </DocumentoImpressao>
    </>
  )
}
