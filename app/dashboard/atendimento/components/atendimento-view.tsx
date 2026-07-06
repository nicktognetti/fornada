'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Bot, User, Send, RefreshCw, Loader2, MessageCircle, Truck,
  ClipboardList, Check, ArrowRight, PhoneOff, Phone, BarChart3, ContactRound, Save,
} from 'lucide-react'
import {
  listarConversas, getConversa, assumirConversa, devolverConversa,
  responderConversa, confirmarEncomendaAnotada, getClienteDaConversa, salvarClienteDaConversa,
  type ConversaResumo, type ConversaDetalhe, type EncomendaAnotada, type ClienteDaConversa,
} from '@/app/actions/atendimento'
import { VirarPedidoModal } from './virar-pedido-modal'
import { PedidosView } from './pedidos-view'
import { CanaisView } from './canais-view'
import { RelatorioView } from './relatorio-view'

type CanalFiltro = 'todos' | 'encomendas' | 'delivery'

const CANAL_CHIP: Record<'encomendas' | 'delivery', { label: string; cls: string; icon: typeof Truck }> = {
  encomendas: { label: 'Encomendas', cls: 'bg-accent-primary/15 text-accent-primary border-accent-primary/25', icon: ClipboardList },
  delivery:   { label: 'Delivery',   cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25',                   icon: Truck },
}

function horaCurta(iso: string): string {
  const d = new Date(iso)
  const hoje = new Date().toDateString() === d.toDateString()
  return hoje
    ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function AtendimentoView({ conversasIniciais }: { conversasIniciais: ConversaResumo[] }) {
  const [modo, setModo] = useState<'conversas' | 'pedidos' | 'relatorio' | 'robo'>('conversas')
  const [conversas, setConversas] = useState<ConversaResumo[]>(conversasIniciais)
  const [canal, setCanal] = useState<CanalFiltro>('todos')
  const [selecionada, setSelecionada] = useState<string | null>(null)
  const [detalhe, setDetalhe] = useState<ConversaDetalhe | null>(null)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, startTransition] = useTransition()
  const [pedidoModal, setPedidoModal] = useState<EncomendaAnotada | null>(null)
  const fimDasMensagens = useRef<HTMLDivElement>(null)

  const atualizarLista = useCallback((c: CanalFiltro) => {
    startTransition(async () => {
      const res = await listarConversas(c)
      if (res.data) setConversas(res.data.conversas)
    })
  }, [])

  const abrirConversa = useCallback(async (id: string) => {
    setSelecionada(id)
    setCarregandoDetalhe(true)
    setErro(null)
    const res = await getConversa(id)
    if (res.error || !res.data) setErro(res.error ?? 'Erro ao carregar conversa')
    else setDetalhe(res.data)
    setCarregandoDetalhe(false)
  }, [])

  // Auto-atualiza a lista (e a conversa aberta) a cada 30s
  useEffect(() => {
    const t = setInterval(() => {
      atualizarLista(canal)
      if (selecionada) getConversa(selecionada).then((r) => { if (r.data) setDetalhe(r.data) })
    }, 30_000)
    return () => clearInterval(t)
  }, [canal, selecionada, atualizarLista])

  useEffect(() => {
    fimDasMensagens.current?.scrollIntoView({ behavior: 'smooth' })
  }, [detalhe?.mensagens.length])

  function mudarCanal(c: CanalFiltro) {
    setCanal(c)
    atualizarLista(c)
  }

  async function enviarResposta() {
    if (!detalhe || !texto.trim()) return
    setErro(null)
    const msg = texto.trim()
    setTexto('')
    const res = await responderConversa(detalhe.id, msg)
    if (res.error) { setErro(res.error); setTexto(msg); return }
    await abrirConversa(detalhe.id)
    atualizarLista(canal)
  }

  async function togglePausa() {
    if (!detalhe) return
    setErro(null)
    const res = detalhe.pausada ? await devolverConversa(detalhe.id) : await assumirConversa(detalhe.id)
    if (res.error) { setErro(res.error); return }
    await abrirConversa(detalhe.id)
    atualizarLista(canal)
  }

  const listaFiltrada = conversas

  // Vindo da aba Pedidos: troca para Conversas já com a conversa aberta
  function verConversa(conversaId: string) {
    setModo('conversas')
    abrirConversa(conversaId)
  }

  const abas = (
    <div className="flex items-center gap-1 bg-input rounded-xl p-1 w-fit mb-4">
      {([
        { id: 'conversas', label: 'Conversas', icon: MessageCircle },
        { id: 'pedidos',   label: 'Pedidos',   icon: ClipboardList },
        { id: 'relatorio', label: 'Relatório', icon: BarChart3 },
        { id: 'robo',      label: 'Robô',      icon: Bot },
      ] as const).map((aba) => (
        <button
          key={aba.id}
          onClick={() => setModo(aba.id)}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            modo === aba.id ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary'
          }`}
        >
          <aba.icon size={14} />
          {aba.label}
        </button>
      ))}
    </div>
  )

  if (modo === 'pedidos') {
    return (
      <>
        {abas}
        <PedidosView onVerConversa={verConversa} />
      </>
    )
  }

  if (modo === 'relatorio') {
    return (
      <>
        {abas}
        <RelatorioView />
      </>
    )
  }

  if (modo === 'robo') {
    return (
      <>
        {abas}
        <CanaisView />
      </>
    )
  }

  return (
    <>
    {abas}
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 items-start">
      {/* ── Coluna esquerda: conversas ── */}
      <div className="card-surface overflow-hidden">
        <div className="flex items-center gap-1 p-2 border-b border-subtle">
          {(['todos', 'encomendas', 'delivery'] as const).map((c) => (
            <button
              key={c}
              onClick={() => mudarCanal(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                canal === c ? 'bg-input text-primary' : 'text-secondary hover:text-primary'
              }`}
            >
              {c === 'todos' ? 'Todos' : CANAL_CHIP[c].label}
            </button>
          ))}
          <button
            onClick={() => atualizarLista(canal)}
            className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:text-primary hover:bg-input transition-colors"
            title="Atualizar"
          >
            {pendente ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>

        {listaFiltrada.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <MessageCircle size={26} className="text-secondary/40 mb-3" />
            <p className="text-sm text-secondary">Nenhuma conversa ainda.</p>
            <p className="text-xs text-faint mt-1">
              Quando um cliente chamar no WhatsApp, a conversa aparece aqui.
            </p>
          </div>
        )}

        <div className="divide-y divide-subtle max-h-[70vh] overflow-y-auto">
          {listaFiltrada.map((c) => {
            const chip = CANAL_CHIP[c.canal]
            return (
              <button
                key={c.id}
                onClick={() => abrirConversa(c.id)}
                className={`w-full text-left px-4 py-3 transition-colors ${
                  selecionada === c.id ? 'bg-input' : 'hover:bg-input/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-primary truncate flex-1">
                    {c.nome || c.numero}
                  </p>
                  <span className="text-[10px] text-faint tabular-nums shrink-0">{horaCurta(c.atualizado_em)}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${chip.cls}`}>
                    <chip.icon size={9} />
                    {chip.label}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                      c.pausada
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/25'
                        : 'bg-success/10 text-success border-success/25'
                    }`}
                    title={c.pausada ? 'Atendente humano no controle' : 'Robô respondendo'}
                  >
                    {c.pausada ? <User size={9} /> : <Bot size={9} />}
                    {c.pausada ? 'Humano' : 'Robô'}
                  </span>
                  {c.encomendas_anotadas > 0 && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-accent-primary/15 text-accent-primary border border-accent-primary/25">
                      {c.encomendas_anotadas} 📝
                    </span>
                  )}
                </div>
                {c.ultima_mensagem && (
                  <p className="text-xs text-secondary truncate mt-1">{c.ultima_mensagem}</p>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Coluna direita: conversa aberta ── */}
      <div className="card-surface overflow-hidden min-h-[420px] flex flex-col">
        {!selecionada && (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
            <MessageCircle size={30} className="text-secondary/40 mb-3" />
            <p className="text-primary font-playfair">Selecione uma conversa</p>
            <p className="text-xs text-faint mt-1 max-w-xs">
              Você vê o que o robô conversou, pode assumir o atendimento e transformar pedidos anotados em encomendas.
            </p>
          </div>
        )}

        {selecionada && carregandoDetalhe && (
          <div className="flex-1 flex items-center justify-center py-20 text-secondary">
            <Loader2 size={20} className="animate-spin" />
          </div>
        )}

        {selecionada && !carregandoDetalhe && detalhe && (
          <>
            {/* Cabeçalho */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-subtle">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-primary truncate">{detalhe.nome || detalhe.numero}</p>
                <p className="text-[11px] text-faint">{detalhe.numero} · {CANAL_CHIP[detalhe.canal].label}</p>
              </div>
              <ClientePanel conversaId={detalhe.id} />
              <button
                onClick={togglePausa}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  detalhe.pausada
                    ? 'bg-success/10 text-success border-success/25 hover:bg-success/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/25 hover:bg-amber-500/20'
                }`}
                title={detalhe.pausada
                  ? 'Devolver a conversa para o robô responder'
                  : 'Assumir: o robô fica mudo por 1h (renova a cada resposta sua)'}
              >
                {detalhe.pausada ? <Phone size={12} /> : <PhoneOff size={12} />}
                {detalhe.pausada ? 'Devolver ao robô' : 'Assumir conversa'}
              </button>
            </div>

            {/* Pedidos anotados pelo robô */}
            {detalhe.encomendas.length > 0 && (
              <div className="px-4 py-3 border-b border-subtle bg-canvas/60 space-y-2 max-h-44 overflow-y-auto">
                {detalhe.encomendas.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 rounded-lg bg-surface border border-subtle px-3 py-2">
                    <span className="text-base shrink-0">📝</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-primary truncate">
                        <span className="font-semibold">{e.produto}</span>
                        {e.quantidade && ` · ${e.quantidade}`}
                        {e.data_texto && ` · ${e.data_texto}`}
                      </p>
                      <p className="text-[11px] text-faint truncate">
                        {[e.nome, e.endereco].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                    {e.status === 'anotada' && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={async () => { await confirmarEncomendaAnotada(e.id); abrirConversa(detalhe.id) }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-input text-ink-soft hover:text-primary transition-colors"
                          title="Marcar como confirmada com o cliente"
                        >
                          <Check size={11} />
                          Confirmada
                        </button>
                        <button
                          onClick={() => setPedidoModal(e)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-accent-primary/15 text-accent-primary hover:bg-accent-primary/25 transition-colors"
                          title="Criar a encomenda oficial no módulo de Encomendas"
                        >
                          Virar pedido
                          <ArrowRight size={11} />
                        </button>
                      </div>
                    )}
                    {e.status === 'confirmada' && (
                      <span className="shrink-0 text-[10px] font-semibold text-success">confirmada</span>
                    )}
                    {e.status === 'virou_pedido' && e.encomenda_id && (
                      <Link href={`/dashboard/encomendas/${e.encomenda_id}`}
                        className="shrink-0 text-[11px] font-medium text-accent-primary hover:underline">
                        ver pedido →
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 max-h-[46vh]">
              {detalhe.mensagens.length === 0 && (
                <p className="text-xs text-faint text-center py-8">Sem mensagens registradas.</p>
              )}
              {detalhe.mensagens.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words ${
                    m.role === 'user'
                      ? 'bg-input text-primary rounded-bl-sm'
                      : 'bg-accent-primary/15 text-primary border border-accent-primary/20 rounded-br-sm'
                  }`}>
                    {m.conteudo}
                    <p className="text-[10px] text-faint mt-1 text-right tabular-nums">{horaCurta(m.criado_em)}</p>
                  </div>
                </div>
              ))}
              <div ref={fimDasMensagens} />
            </div>

            {/* Responder */}
            <div className="border-t border-subtle p-3">
              {erro && <p className="text-xs text-danger bg-danger-tint rounded-lg px-3 py-2 mb-2">{erro}</p>}
              <div className="flex items-end gap-2">
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarResposta() } }}
                  placeholder={detalhe.pausada
                    ? 'Responda como atendente (o robô está mudo)…'
                    : 'Responder assume a conversa (o robô fica mudo por 1h)…'}
                  rows={2}
                  className="input-field flex-1 resize-none text-sm"
                />
                <button
                  onClick={enviarResposta}
                  disabled={!texto.trim()}
                  className="btn-primary shrink-0 h-10 w-10 !p-0 flex items-center justify-center disabled:opacity-40"
                  title="Enviar pelo WhatsApp"
                >
                  <Send size={15} />
                </button>
              </div>
            </div>
          </>
        )}

        {selecionada && !carregandoDetalhe && !detalhe && erro && (
          <p className="m-4 text-sm text-danger bg-danger-tint rounded-lg px-3 py-2">{erro}</p>
        )}
      </div>

      {pedidoModal && detalhe && (
        <VirarPedidoModal
          anotada={pedidoModal}
          onClose={() => setPedidoModal(null)}
          onDone={() => { setPedidoModal(null); abrirConversa(detalhe.id) }}
        />
      )}
    </div>
    </>
  )
}

// ── Cadastro do cliente pela conversa (nome, endereço, observação) ────────────
function ClientePanel({ conversaId }: { conversaId: string }) {
  const [aberto, setAberto] = useState(false)
  const [cliente, setCliente] = useState<ClienteDaConversa | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function abrir() {
    if (aberto) { setAberto(false); return }
    setAberto(true)
    setMsg(null)
    setCarregando(true)
    const res = await getClienteDaConversa(conversaId)
    if (res.data) setCliente(res.data)
    else setMsg(res.error ?? 'Erro ao carregar')
    setCarregando(false)
  }

  async function salvar() {
    if (!cliente) return
    setSalvando(true)
    setMsg(null)
    const res = await salvarClienteDaConversa(conversaId, {
      nome: cliente.nome,
      endereco: cliente.endereco,
      observacao: cliente.observacao,
    })
    setSalvando(false)
    setMsg(res.error ?? 'Salvo ✓ — o robô já usa na próxima conversa')
  }

  return (
    <div className="relative shrink-0">
      <button
        onClick={abrir}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
          aberto
            ? 'bg-accent-primary/15 text-accent-primary border-accent-primary/30'
            : 'bg-input text-secondary border-transparent hover:text-primary'
        }`}
        title="Ver/editar o cadastro deste cliente (nome, endereço salvo, observação)"
      >
        <ContactRound size={12} />
        Cliente
      </button>

      {aberto && (
        <div className="absolute right-0 top-10 z-30 w-80 card-surface border border-subtle p-4 space-y-3 shadow-xl">
          {carregando && <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-secondary" /></div>}
          {!carregando && cliente && (
            <>
              <p className="text-[11px] text-faint">WhatsApp: {cliente.telefone}{cliente.id ? '' : ' · ainda sem cadastro'}</p>
              <div>
                <label className="field-label">Nome</label>
                <input type="text" value={cliente.nome}
                  onChange={(e) => setCliente({ ...cliente, nome: e.target.value })}
                  className="input-field text-sm" />
              </div>
              <div>
                <label className="field-label">Endereço salvo (delivery)</label>
                <input type="text" value={cliente.endereco ?? ''}
                  onChange={(e) => setCliente({ ...cliente, endereco: e.target.value || null })}
                  placeholder="rua, número, bairro" className="input-field text-sm" />
              </div>
              <div>
                <label className="field-label">Observação da equipe</label>
                <input type="text" value={cliente.observacao ?? ''}
                  onChange={(e) => setCliente({ ...cliente, observacao: e.target.value || null })}
                  placeholder="ex: cliente antigo, prefere retirar cedo" className="input-field text-sm" />
              </div>
              {msg && <p className={`text-xs ${msg.startsWith('Salvo') ? 'text-success' : 'text-danger'}`}>{msg}</p>}
              <div className="flex justify-end">
                <button onClick={salvar} disabled={salvando || !cliente.nome.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-primary/15 text-accent-primary border border-accent-primary/25 hover:bg-accent-primary/25 transition-colors disabled:opacity-50">
                  {salvando ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Salvar
                </button>
              </div>
            </>
          )}
          {!carregando && !cliente && msg && <p className="text-xs text-danger">{msg}</p>}
        </div>
      )}
    </div>
  )
}
