'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { ClipboardList, Truck, Check, ArrowRight, MessageCircle, RefreshCw, Loader2, Home, Printer } from 'lucide-react'
import {
  listarPedidos, confirmarEncomendaAnotada,
  type PedidoAnotado, type EncomendaAnotada,
} from '@/app/actions/atendimento'
import { VirarPedidoModal } from './virar-pedido-modal'
import { imprimirComanda } from './comanda-impressao'

// Impressão automática é POR APARELHO (fica no navegador do computador
// que tem a impressora térmica) — por isso localStorage, não banco.
const AUTOPRINT_KEY = 'fornada_atendimento_autoprint'

type CanalFiltro = 'todos' | 'encomendas' | 'delivery'
type StatusFiltro = 'todos' | 'anotada' | 'confirmada' | 'virou_pedido'

const STATUS_CHIP: Record<'anotada' | 'confirmada' | 'virou_pedido', { label: string; cls: string }> = {
  anotada:      { label: 'Anotada',      cls: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
  confirmada:   { label: 'Confirmada',   cls: 'bg-success/10 text-success border-success/25' },
  virou_pedido: { label: 'Virou pedido', cls: 'bg-accent-primary/15 text-accent-primary border-accent-primary/25' },
}

/** Hoje no fuso local (YYYY-MM-DD). */
function hojeLocal(): string {
  return new Date().toLocaleDateString('sv')
}

function quando(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
    ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// Aba "Pedidos": tudo que o robô anotou, por dia/canal/status — sem precisar
// abrir as conversas (mas com atalho para elas).
export function PedidosView({ onVerConversa }: { onVerConversa: (conversaId: string) => void }) {
  const [pedidos, setPedidos] = useState<PedidoAnotado[]>([])
  const [canal, setCanal] = useState<CanalFiltro>('todos')
  const [status, setStatus] = useState<StatusFiltro>('todos')
  const [dia, setDia] = useState<string | null>(hojeLocal())
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, startTransition] = useTransition()
  const [modal, setModal] = useState<EncomendaAnotada | null>(null)
  const [autoPrint, setAutoPrint] = useState(false)
  // ids já vistos neste aparelho — pedido novo com auto-impressão ligada sai na térmica
  const idsVistos = useRef<Set<string> | null>(null)

  useEffect(() => {
    // localStorage só existe no cliente — init no mount evita mismatch de hidratação.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAutoPrint(localStorage.getItem(AUTOPRINT_KEY) === '1')
  }, [])

  function toggleAutoPrint() {
    const novo = !autoPrint
    setAutoPrint(novo)
    localStorage.setItem(AUTOPRINT_KEY, novo ? '1' : '0')
  }

  const carregar = useCallback((c: CanalFiltro, s: StatusFiltro, d: string | null) => {
    startTransition(async () => {
      const res = await listarPedidos({ canal: c, status: s, data: d })
      if (res.error || !res.data) { setErro(res.error ?? 'Erro ao carregar pedidos'); return }
      setErro(null)
      setPedidos(res.data.pedidos)

      // Auto-impressão: imprime só o que chegou DEPOIS que a tela abriu
      const atuais = new Set(res.data.pedidos.map((p) => p.id))
      if (idsVistos.current !== null && localStorage.getItem(AUTOPRINT_KEY) === '1') {
        for (const p of res.data.pedidos) {
          if (!idsVistos.current.has(p.id) && p.status === 'anotada') imprimirComanda(p)
        }
      }
      idsVistos.current = atuais
    })
  }, [])

  useEffect(() => { carregar(canal, status, dia) }, [canal, status, dia, carregar])

  // Auto-atualiza a cada 30s (pedido novo do robô aparece sozinho)
  useEffect(() => {
    const t = setInterval(() => carregar(canal, status, dia), 30_000)
    return () => clearInterval(t)
  }, [canal, status, dia, carregar])

  async function confirmar(id: string) {
    await confirmarEncomendaAnotada(id)
    carregar(canal, status, dia)
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-input rounded-xl p-1">
          {(['todos', 'encomendas', 'delivery'] as const).map((c) => (
            <button key={c} onClick={() => setCanal(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                canal === c ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary'
              }`}>
              {c === 'todos' ? 'Todos' : c === 'encomendas' ? 'Encomendas' : 'Delivery'}
            </button>
          ))}
        </div>

        <select value={status} onChange={(e) => setStatus(e.target.value as StatusFiltro)}
          className="input-field text-xs py-1.5 px-2 w-36">
          <option value="todos">Todos os status</option>
          <option value="anotada">Anotada (pendente)</option>
          <option value="confirmada">Confirmada</option>
          <option value="virou_pedido">Virou pedido</option>
        </select>

        <input type="date" value={dia ?? ''} onChange={(e) => setDia(e.target.value || null)}
          className="input-field text-xs py-1.5 px-2 w-36" title="Ver pedidos de um dia" />
        {dia !== null ? (
          <button onClick={() => setDia(null)} className="text-xs text-secondary hover:text-primary px-2 py-1 rounded-lg hover:bg-input transition-colors">
            Todos os dias
          </button>
        ) : (
          <button onClick={() => setDia(hojeLocal())} className="text-xs text-secondary hover:text-primary px-2 py-1 rounded-lg hover:bg-input transition-colors">
            Só hoje
          </button>
        )}

        <button
          onClick={toggleAutoPrint}
          className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            autoPrint
              ? 'bg-accent-primary/15 text-accent-primary border-accent-primary/30'
              : 'bg-input text-secondary border-transparent hover:text-primary'
          }`}
          title="Pedido novo já abre a impressão da comanda (80mm) NESTE aparelho — deixe o painel aberto no computador da impressora térmica"
        >
          <Printer size={13} />
          {autoPrint ? 'Impressão automática: LIGADA' : 'Impressão automática'}
        </button>

        <button onClick={() => carregar(canal, status, dia)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:text-primary hover:bg-input transition-colors" title="Atualizar">
          {carregando ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </button>
      </div>

      {autoPrint && (
        <p className="text-[11px] text-faint -mt-2">
          🖨️ Impressão automática ligada <b>neste aparelho</b>: pedido novo abre o diálogo de impressão com a comanda
          80mm pronta (deixe a térmica como impressora padrão e o painel aberto).
        </p>
      )}

      {erro && <p className="text-sm text-danger bg-danger-tint rounded-lg px-3 py-2">{erro}</p>}

      {/* Resumo do período filtrado */}
      {pedidos.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap text-[11px]">
          <span className="px-2 py-1 rounded-lg bg-input text-secondary">
            {pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''}
          </span>
          <span className="px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            🛵 {pedidos.filter((p) => p.canal === 'delivery').length} delivery
          </span>
          <span className="px-2 py-1 rounded-lg bg-accent-primary/10 text-accent-primary border border-accent-primary/20">
            📝 {pedidos.filter((p) => p.canal === 'encomendas').length} encomendas
          </span>
          <span className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            {pedidos.filter((p) => p.status === 'anotada').length} aguardando
          </span>
          <span className="px-2 py-1 rounded-lg bg-success/10 text-success border border-success/20">
            {pedidos.filter((p) => p.status === 'virou_pedido').length} viraram pedido
          </span>
        </div>
      )}

      {/* Lista */}
      {pedidos.length === 0 && !erro && (
        <div className="card-surface flex flex-col items-center justify-center py-16 text-center px-6">
          <ClipboardList size={26} className="text-secondary/40 mb-3" />
          <p className="text-sm text-secondary">
            {dia ? `Nenhum pedido anotado ${dia === hojeLocal() ? 'hoje' : `em ${dia.split('-').reverse().join('/')}`}.` : 'Nenhum pedido anotado ainda.'}
          </p>
          <p className="text-xs text-faint mt-1">Quando o robô anotar um pedido no WhatsApp, ele aparece aqui.</p>
        </div>
      )}

      <div className="space-y-2">
        {pedidos.map((p) => {
          const st = STATUS_CHIP[p.status]
          const CanalIcon = p.canal === 'delivery' ? Truck : ClipboardList
          return (
            <div key={p.id} className="card-surface px-4 py-3 flex items-center gap-3 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border shrink-0 ${
                p.canal === 'delivery'
                  ? 'bg-blue-500/15 text-blue-400 border-blue-500/25'
                  : 'bg-accent-primary/15 text-accent-primary border-accent-primary/25'
              }`}>
                <CanalIcon size={10} />
                {p.canal === 'delivery' ? 'Delivery' : 'Encomenda'}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm text-primary truncate">
                  <span className="font-semibold">{p.produto}</span>
                  {p.quantidade && p.quantidade !== '?' && <span className="text-secondary"> · {p.quantidade}</span>}
                </p>
                <p className="text-[11px] text-faint truncate flex items-center gap-1.5 flex-wrap">
                  <span className="tabular-nums">{quando(p.criado_em)}</span>
                  {(p.nome || p.cliente_nome) && <span>· {p.nome || p.cliente_nome}</span>}
                  <span>· {p.cliente_numero}</span>
                  {p.canal === 'delivery' && p.endereco && (
                    <span className="inline-flex items-center gap-1">· <Home size={9} /> {p.endereco}</span>
                  )}
                  {p.canal === 'encomendas' && p.data_texto && <span>· retirada: {p.data_texto}</span>}
                </p>
              </div>

              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${st.cls}`}>
                {st.label}
              </span>

              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => imprimirComanda(p)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-secondary/60 hover:text-primary hover:bg-input transition-colors"
                  title="Imprimir comanda (80mm)">
                  <Printer size={13} />
                </button>
                {p.status === 'anotada' && (
                  <>
                    <button onClick={() => confirmar(p.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-input text-ink-soft hover:text-primary transition-colors"
                      title="Marcar como confirmada com o cliente">
                      <Check size={11} />
                      Confirmada
                    </button>
                    <button onClick={() => setModal(p)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-accent-primary/15 text-accent-primary hover:bg-accent-primary/25 transition-colors"
                      title="Criar a encomenda oficial no módulo de Encomendas">
                      Virar pedido
                      <ArrowRight size={11} />
                    </button>
                  </>
                )}
                {p.status === 'virou_pedido' && p.encomenda_id && (
                  <Link href={`/dashboard/encomendas/${p.encomenda_id}`}
                    className="text-[11px] font-medium text-accent-primary hover:underline">
                    ver pedido →
                  </Link>
                )}
                <button onClick={() => onVerConversa(p.conversa_id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-secondary/60 hover:text-primary hover:bg-input transition-colors"
                  title="Abrir a conversa completa">
                  <MessageCircle size={13} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {pedidos.length > 0 && (
        <p className="text-secondary/40 text-xs text-right">
          {pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''}
          {dia ? ` em ${dia.split('-').reverse().join('/')}` : ' (todos os dias)'}
        </p>
      )}

      {modal && (
        <VirarPedidoModal
          anotada={modal}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); carregar(canal, status, dia) }}
        />
      )}
    </div>
  )
}
