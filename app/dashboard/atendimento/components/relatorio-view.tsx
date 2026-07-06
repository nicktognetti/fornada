'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { BarChart3, Truck, ClipboardList, Loader2 } from 'lucide-react'
import { relatorioAtendimento, type PedidoRelatorio } from '@/app/actions/atendimento'
import { DocumentoImpressao, BotaoImprimir, tabelaImpressao as T } from '@/app/components/ui/documento-impressao'

/** Mês atual no fuso local (YYYY-MM). */
function mesAtual(): string {
  return new Date().toLocaleDateString('sv').slice(0, 7)
}

/** "Pão Francês " → "pão francês" (agrupa variações de caixa/espaço). */
function chaveProduto(p: string): string {
  return p.trim().toLowerCase().replace(/\s+/g, ' ')
}

// Aba "Relatório": números do mês por loja — pedidos por canal/dia,
// conversão anotado → pedido e produtos mais pedidos.
export function RelatorioView() {
  const [mes, setMes] = useState(mesAtual())
  const [pedidos, setPedidos] = useState<PedidoRelatorio[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, startTransition] = useTransition()

  const carregar = useCallback((m: string) => {
    startTransition(async () => {
      const res = await relatorioAtendimento(m)
      if (res.error || !res.data) setErro(res.error ?? 'Erro ao carregar')
      else { setErro(null); setPedidos(res.data.pedidos) }
    })
  }, [])

  useEffect(() => { carregar(mes) }, [mes, carregar])

  const stats = useMemo(() => {
    const total = pedidos.length
    const delivery = pedidos.filter((p) => p.canal === 'delivery').length
    const encomendas = total - delivery
    const viraram = pedidos.filter((p) => p.status === 'virou_pedido').length
    const conversao = total > 0 ? Math.round((viraram / total) * 100) : 0

    // Por dia do mês
    const porDia = new Map<string, number>()
    for (const p of pedidos) {
      const dia = new Date(p.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      porDia.set(dia, (porDia.get(dia) ?? 0) + 1)
    }
    const dias = [...porDia.entries()]
    const maxDia = Math.max(1, ...dias.map(([, n]) => n))

    // Produtos mais pedidos
    const porProduto = new Map<string, number>()
    for (const p of pedidos) {
      const chave = chaveProduto(p.produto)
      porProduto.set(chave, (porProduto.get(chave) ?? 0) + 1)
    }
    const topProdutos = [...porProduto.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    const maxProduto = Math.max(1, ...topProdutos.map(([, n]) => n))

    return { total, delivery, encomendas, viraram, conversao, dias, maxDia, topProdutos, maxProduto }
  }, [pedidos])

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3 flex-wrap">
        <input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)}
          className="input-field text-sm py-1.5 px-2 w-44" />
        {carregando && <Loader2 size={14} className="animate-spin text-secondary" />}
        <BotaoImprimir label="Imprimir / PDF" className="ml-auto px-4" />
      </div>

      {erro && <p className="text-sm text-danger bg-danger-tint rounded-lg px-3 py-2">{erro}</p>}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card-surface p-4">
          <p className="text-[10px] uppercase tracking-wider text-secondary">Pedidos no mês</p>
          <p className="font-playfair text-2xl font-bold text-primary tabular-nums mt-1">{stats.total}</p>
        </div>
        <div className="card-surface p-4">
          <p className="text-[10px] uppercase tracking-wider text-secondary flex items-center gap-1"><Truck size={10} /> Delivery</p>
          <p className="font-playfair text-2xl font-bold text-blue-400 tabular-nums mt-1">{stats.delivery}</p>
        </div>
        <div className="card-surface p-4">
          <p className="text-[10px] uppercase tracking-wider text-secondary flex items-center gap-1"><ClipboardList size={10} /> Encomendas</p>
          <p className="font-playfair text-2xl font-bold text-accent-primary tabular-nums mt-1">{stats.encomendas}</p>
        </div>
        <div className="card-surface p-4" title="Quantos pedidos anotados viraram encomenda oficial">
          <p className="text-[10px] uppercase tracking-wider text-secondary">Viraram pedido</p>
          <p className="font-playfair text-2xl font-bold text-success tabular-nums mt-1">
            {stats.conversao}%
            <span className="text-xs font-normal text-secondary ml-1">({stats.viraram})</span>
          </p>
        </div>
      </div>

      {stats.total === 0 && !erro && !carregando && (
        <div className="card-surface flex flex-col items-center justify-center py-14 text-center px-6">
          <BarChart3 size={26} className="text-secondary/40 mb-3" />
          <p className="text-sm text-secondary">Nenhum pedido do robô neste mês.</p>
        </div>
      )}

      {/* Pedidos por dia */}
      {stats.dias.length > 0 && (
        <div className="card-surface p-4 space-y-2">
          <p className="field-label">Pedidos por dia</p>
          {stats.dias.map(([dia, n]) => (
            <div key={dia} className="flex items-center gap-2">
              <span className="text-[11px] text-secondary tabular-nums w-12 shrink-0">{dia}</span>
              <div className="flex-1 h-4 rounded bg-input overflow-hidden">
                <div className="h-full bg-accent-primary/60 rounded" style={{ width: `${(n / stats.maxDia) * 100}%` }} />
              </div>
              <span className="text-[11px] text-primary tabular-nums w-6 text-right shrink-0">{n}</span>
            </div>
          ))}
        </div>
      )}

      {/* Produtos mais pedidos */}
      {stats.topProdutos.length > 0 && (
        <div className="card-surface p-4 space-y-2">
          <p className="field-label">Produtos mais pedidos</p>
          {stats.topProdutos.map(([produto, n]) => (
            <div key={produto} className="flex items-center gap-2">
              <span className="text-xs text-primary truncate w-44 shrink-0" title={produto}>{produto}</span>
              <div className="flex-1 h-4 rounded bg-input overflow-hidden">
                <div className="h-full bg-blue-500/50 rounded" style={{ width: `${(n / stats.maxProduto) * 100}%` }} />
              </div>
              <span className="text-[11px] text-primary tabular-nums w-6 text-right shrink-0">{n}</span>
            </div>
          ))}
          <p className="text-[11px] text-faint pt-1">
            Contagem por texto anotado pelo robô — variações de escrita podem aparecer separadas.
          </p>
        </div>
      )}

      {/* Documento de impressão / PDF (Ctrl+P → salvar como PDF) */}
      <DocumentoImpressao
        titulo="Relatório de Atendimento — Robô do WhatsApp"
        subtitulo={`Mês ${mes.split('-').reverse().join('/')} · ${stats.total} pedido${stats.total !== 1 ? 's' : ''}`}
      >
        <table style={T.table}>
          <thead>
            <tr>
              <th style={T.th}>Indicador</th>
              <th style={T.thRight}>Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style={T.td}>Pedidos no mês</td><td style={T.tdRight}>{stats.total}</td></tr>
            <tr><td style={T.td}>Delivery</td><td style={T.tdRight}>{stats.delivery}</td></tr>
            <tr><td style={T.td}>Encomendas</td><td style={T.tdRight}>{stats.encomendas}</td></tr>
            <tr><td style={T.td}>Viraram pedido oficial</td><td style={T.tdRight}>{stats.viraram} ({stats.conversao}%)</td></tr>
          </tbody>
        </table>
        {stats.dias.length > 0 && (
          <table style={{ ...T.table, marginTop: 16 }}>
            <thead>
              <tr><th style={T.th}>Dia</th><th style={T.thRight}>Pedidos</th></tr>
            </thead>
            <tbody>
              {stats.dias.map(([dia, n]) => (
                <tr key={dia}><td style={T.td}>{dia}</td><td style={T.tdRight}>{n}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        {stats.topProdutos.length > 0 && (
          <table style={{ ...T.table, marginTop: 16 }}>
            <thead>
              <tr><th style={T.th}>Produto mais pedido</th><th style={T.thRight}>Vezes</th></tr>
            </thead>
            <tbody>
              {stats.topProdutos.map(([produto, n]) => (
                <tr key={produto}><td style={T.td}>{produto}</td><td style={T.tdRight}>{n}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </DocumentoImpressao>
    </div>
  )
}
