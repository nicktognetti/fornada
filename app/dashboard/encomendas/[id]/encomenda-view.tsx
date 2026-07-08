'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Trash2, ChefHat, PackageCheck, CheckCircle2, CalendarClock, Loader2, Pencil, History } from 'lucide-react'
import { formatBRL } from '@/lib/format'
import { formatDuracao } from '@/lib/duracao'
import { DocumentoImpressao, BotaoImprimir, tabelaImpressao as T } from '@/app/components/ui/documento-impressao'
import { atualizarStatusEncomenda, excluirEncomenda, type EncomendaDetalhe, type EncomendaStatus } from '@/app/actions/encomenda'
import { StatusBadgeEncomenda } from '../components/status-badge-encomenda'

function fmtData(d: string) { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}` }
function fmtHora(h: string | null) { return h ? h.slice(0, 5) : null }
function fmtDataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const STATUS_LABEL: Record<EncomendaStatus, string> = {
  pendente: 'Pendente', em_producao: 'Em produção', pronto: 'Pronto', entregue: 'Entregue', cancelada: 'Cancelada',
}

// Fluxo completo (com acompanhamento de produção)
const PROXIMO: Partial<Record<EncomendaStatus, { status: EncomendaStatus; label: string; icon: typeof ChefHat }>> = {
  pendente:    { status: 'em_producao', label: 'Iniciar produção', icon: ChefHat },
  em_producao: { status: 'pronto',      label: 'Marcar pronto',    icon: PackageCheck },
  pronto:      { status: 'entregue',    label: 'Marcar entregue',  icon: CheckCircle2 },
}

export function EncomendaView({ encomenda: e }: { encomenda: EncomendaDetalhe }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  // Sem acompanhamento: vai direto de pendente para entregue.
  const proximo = e.rastrear_status
    ? PROXIMO[e.status]
    : (e.status === 'pendente' ? { status: 'entregue' as EncomendaStatus, label: 'Marcar entregue', icon: CheckCircle2 } : undefined)
  const horaTxt = fmtHora(e.hora_entrega)

  // Linha do tempo: duração de cada etapa (última = até agora, se não finalizada).
  // "Agora" congelado no mount — render puro; um refresh do router traz novo valor.
  const [agora] = useState(() => Date.now())
  const finalizada = e.status === 'entregue' || e.status === 'cancelada'
  const timeline = e.historico.map((ev, i) => {
    const inicio = new Date(ev.changed_at).getTime()
    const prox = e.historico[i + 1]
    const fim = prox ? new Date(prox.changed_at).getTime() : agora
    const emAndamento = !prox && !finalizada
    return { status: ev.status, at: ev.changed_at, durMs: fim - inicio, emAndamento, ultimaFinal: !prox && finalizada }
  })

  // Agrupa itens por local (setor). Se houver mais de um, a comanda sai separada por setor.
  const gruposLocal = (() => {
    const m = new Map<string, typeof e.itens>()
    for (const it of e.itens) {
      const k = it.local && it.local.trim() ? it.local.trim() : 'Sem local'
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(it)
    }
    return [...m.entries()]
  })()
  const multiLocal = gruposLocal.length > 1

  async function mudarStatus(status: EncomendaStatus) {
    setBusy(true)
    await atualizarStatusEncomenda(e.id, status)
    setBusy(false)
    router.refresh()
  }
  async function excluir() {
    setBusy(true)
    await excluirEncomenda(e.id)
    router.push('/dashboard/encomendas')
  }

  return (
    <>
      <div className="card-surface px-6 py-5 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-secondary text-xs mb-1 tabular-nums">Encomenda Nº {e.numero}</p>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <h1 className="font-playfair text-primary text-[26px] font-bold leading-tight">{e.cliente_nome}</h1>
              <StatusBadgeEncomenda status={e.status} />
            </div>
            <p className="text-secondary text-sm flex items-center gap-1.5">
              <CalendarClock size={14} className="text-accent-primary" />
              Entrega {fmtData(e.data_entrega)}{horaTxt ? ` às ${horaTxt}` : ''}{e.cliente_contato ? ` · ${e.cliente_contato}` : ''}
            </p>
          </div>
          {e.podeVerValores && e.total > 0 && (
            <div className="text-right">
              <p className="field-label mb-1">Total</p>
              <p className="font-playfair text-accent-primary text-[28px] font-bold leading-none tabular-nums">R$ {formatBRL(e.total)}</p>
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="flex gap-2 mt-5 pt-4 border-t border-subtle flex-wrap items-center">
          {proximo && (
            <button onClick={() => mudarStatus(proximo.status)} disabled={busy} className="btn-primary text-xs px-4 py-2 min-h-[36px] disabled:opacity-50">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <proximo.icon size={13} />}
              {proximo.label}
            </button>
          )}
          <BotaoImprimir label="Imprimir comanda" className="text-xs px-4 py-2" />
          {e.podeVerValores && (
            <Link href={`/dashboard/encomendas/${e.id}/editar`} className="btn-ghost text-xs px-4 py-2 min-h-[36px] text-secondary hover:text-primary inline-flex items-center gap-1">
              <Pencil size={13} /> Editar
            </Link>
          )}
          {e.status !== 'cancelada' && e.status !== 'entregue' && (
            <button onClick={() => mudarStatus('cancelada')} disabled={busy} className="btn-ghost text-xs px-4 py-2 min-h-[36px] text-secondary hover:text-primary">
              Cancelar encomenda
            </button>
          )}
          {!confirm ? (
            <button onClick={() => setConfirm(true)} className="btn-ghost text-xs px-4 py-2 min-h-[36px] border-red-500/20 text-red-400/70 hover:text-red-400 hover:border-red-500/40 ml-auto">
              <Trash2 size={13} /> Excluir
            </button>
          ) : (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-red-400 text-xs">Excluir?</span>
              <button onClick={excluir} disabled={busy} className="text-xs text-red-400 border border-red-500/30 hover:bg-red-500/10 rounded-lg px-3 py-1.5">Sim</button>
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
              {e.podeVerValores && <th className="text-right px-4 py-2.5 font-semibold">Preço un.</th>}
              {e.podeVerValores && <th className="text-right px-5 py-2.5 font-semibold">Subtotal</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {e.itens.map((it) => (
              <tr key={it.id}>
                <td className="px-5 py-3 text-primary">
                  {it.descricao}
                  {it.observacao && <span className="block text-xs text-amber-400/80 mt-0.5">↳ {it.observacao}</span>}
                </td>
                <td className="px-4 py-3 text-right text-secondary tabular-nums align-top">{it.quantidade}{it.unidade ? ` ${it.unidade}` : ''}</td>
                {e.podeVerValores && <td className="px-4 py-3 text-right text-secondary tabular-nums align-top">R$ {formatBRL(it.preco_unitario)}</td>}
                {e.podeVerValores && <td className="px-5 py-3 text-right font-medium text-primary tabular-nums align-top">R$ {formatBRL(it.subtotal)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {e.observacao && <p className="px-5 py-3 text-xs text-secondary border-t border-subtle">Obs.: {e.observacao}</p>}
      </div>

      {/* Linha do tempo do status */}
      {timeline.length > 0 && (
        <div className="card-surface mt-5 px-5 py-4">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-secondary mb-3">
            <History size={13} className="text-accent-primary" /> Histórico de status
          </p>
          <div className="space-y-0">
            {timeline.map((t, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-accent-primary/70 shrink-0" />
                <span className="text-sm text-primary w-28 shrink-0">{STATUS_LABEL[t.status]}</span>
                <span className="text-xs text-secondary tabular-nums flex-1">{fmtDataHora(t.at)}</span>
                <span className="text-xs tabular-nums shrink-0">
                  {t.ultimaFinal
                    ? <span className="text-faint">—</span>
                    : t.emAndamento
                      ? <span className="text-amber-400">{formatDuracao(t.durMs)} (em andamento)</span>
                      : <span className="text-secondary">{formatDuracao(t.durMs)}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comanda(s) de impressão — separadas por setor (local) quando houver mais de um */}
      {gruposLocal.map(([local, itensDoLocal], gi) => (
        <DocumentoImpressao
          key={local}
          titulo={multiLocal ? `Comanda — ${local}` : 'Comanda de Encomenda'}
          numero={e.numero}
          subtitulo={`Cliente: ${e.cliente_nome}${e.cliente_contato ? ` · ${e.cliente_contato}` : ''}`}
          unidade={e.unidade_nome}
          unidadeDoc={e.unidade_documento}
          assinaturas={['Responsável', 'Feito por (produção)']}
          quebraPagina={multiLocal && gi < gruposLocal.length - 1}
        >
          {/* Entrega em destaque */}
          <div style={{ border: '2px solid #1a1a1a', borderRadius: '6px', padding: '10px 14px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#444' }}>Entrega{multiLocal ? ` · Setor: ${local}` : ''}</span>
            <span style={{ fontSize: '18px', fontWeight: 700 }}>{fmtData(e.data_entrega)}{horaTxt ? ` — ${horaTxt}` : ''}</span>
          </div>

          <table style={T.table}>
            <thead>
              <tr>
                <th style={{ ...T.thRight, width: '60px' }}>Qtd</th>
                <th style={T.th}>Item</th>
              </tr>
            </thead>
            <tbody>
              {itensDoLocal.map((it) => (
                <tr key={it.id}>
                  <td style={{ ...T.tdRight, verticalAlign: 'top', fontWeight: 700 }}>{it.quantidade}{it.unidade ? ` ${it.unidade}` : ''}</td>
                  <td style={T.td}>
                    {it.descricao}
                    {it.observacao && <div style={{ fontSize: '11px', fontStyle: 'italic', color: '#555' }}>↳ {it.observacao}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {e.observacao && <p style={{ marginTop: '12px', fontSize: '11px', color: '#555' }}>Obs.: {e.observacao}</p>}

          {/* Histórico só na comanda única (sem separação por setor) */}
          {!multiLocal && e.rastrear_status && timeline.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#444', marginBottom: '4px' }}>Histórico de status</p>
              <table style={T.table}>
                <tbody>
                  {timeline.map((t, i) => (
                    <tr key={i}>
                      <td style={{ ...T.td, fontWeight: 600 }}>{STATUS_LABEL[t.status]}</td>
                      <td style={T.td}>{fmtDataHora(t.at)}</td>
                      <td style={T.tdRight}>{t.ultimaFinal ? '—' : `${formatDuracao(t.durMs)}${t.emAndamento ? ' (em andamento)' : ''}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DocumentoImpressao>
      ))}
    </>
  )
}
