'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  X, Plus, Search, Package, ArrowRight, Loader2, Truck,
  ArrowUpFromLine, ArrowDownToLine, MapPin, SearchX,
} from 'lucide-react'
import { createTransferenciaAction } from '@/app/actions/transferencia'
import { normalizeSearch, parseDecimalBR, formatBRL } from '@/lib/format'

type Unidade = { id: string; nome: string }
type Produto  = { id: string; nome: string }
type ItemForm = { produto_id: string; nome: string; quantidade_enviada: number; preco_unitario: number }

/* ── Classes de tema (tokens do @theme) ─────────────────────────────────────── */
const BTN_PRIMARY =
  'inline-flex items-center gap-2 bg-accent-primary hover:bg-accent-hover text-accent-ink font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border-none'

const BTN_GHOST =
  'inline-flex items-center gap-2 bg-transparent border border-subtle text-ink-soft hover:bg-input hover:text-primary font-medium px-5 py-2.5 rounded-lg text-sm transition-colors cursor-pointer'

const INPUT =
  'w-full bg-input border border-subtle rounded-lg px-4 py-2.5 text-sm text-primary placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent-primary/40 focus:border-accent-primary transition-colors'

const LABEL = 'block text-xs font-medium uppercase tracking-wider text-secondary mb-1.5'

const CARD = 'bg-surface border border-subtle rounded-lg shadow-lg shadow-black/20'

interface Props {
  minhaUnidade: Unidade | null
  unidadesDestino: Unidade[]
  produtos: Produto[]
  empresaId: string
}

export function NovaTransferenciaForm({ minhaUnidade, unidadesDestino, produtos, empresaId }: Props) {
  const router = useRouter()

  const todasUnidades: Unidade[] = minhaUnidade
    ? [minhaUnidade, ...unidadesDestino]
    : [...unidadesDestino]

  const isAutoRota = !!minhaUnidade && todasUnidades.length >= 2
  const origemDefault = minhaUnidade?.id ?? todasUnidades[0]?.id ?? ''

  const [tipo,       setTipo]       = useState<'TRANSFERENCIA' | 'DEVOLUCAO'>('TRANSFERENCIA')
  const [origemId,   setOrigemId]   = useState(origemDefault)
  const [observacao, setObservacao] = useState('')
  const [itens,      setItens]      = useState<ItemForm[]>([])
  const [modalOpen,  setModalOpen]  = useState(false)
  const [search,     setSearch]     = useState('')
  const [selected,   setSelected]   = useState<Produto | null>(null)
  const [qtdInput,   setQtdInput]   = useState('1')
  const [precoInput, setPrecoInput] = useState('0')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [sucesso,    setSucesso]    = useState<string | null>(null)

  const unidadeOrigem  = todasUnidades.find((u) => u.id === origemId) ?? todasUnidades[0]
  const unidadeDestino = todasUnidades.find((u) => u.id !== origemId) ?? todasUnidades[1] ?? todasUnidades[0]

  const valorTotal = itens.reduce((acc, i) => acc + i.quantidade_enviada * i.preco_unitario, 0)

  // Subtotal do modal em tempo real
  const subtotalModal = useMemo(() => {
    const qtd = parseDecimalBR(qtdInput)
    const preco = parseDecimalBR(precoInput)
    if (!qtd || qtd <= 0 || !preco || preco < 0) return 0
    return qtd * preco
  }, [qtdInput, precoInput])

  function handleTipoChange(novoTipo: 'TRANSFERENCIA' | 'DEVOLUCAO') {
    if (novoTipo !== tipo && todasUnidades.length === 2 && unidadeDestino) {
      setOrigemId(unidadeDestino.id)
    }
    setTipo(novoTipo)
  }

  const produtosFiltrados = useMemo(() => {
    if (!search.trim()) return produtos
    const q = normalizeSearch(search)
    return produtos.filter((p) => normalizeSearch(p.nome).includes(q))
  }, [search, produtos])

  function adicionarItem() {
    if (!selected) return
    const qtd = parseDecimalBR(qtdInput)
    if (!qtd || qtd <= 0) return
    const preco = parseDecimalBR(precoInput)
    const precoFinal = !Number.isNaN(preco) && preco >= 0 ? preco : 0

    const idx = itens.findIndex((i) => i.produto_id === selected.id)
    if (idx >= 0) {
      setItens((prev) => prev.map((i, n) =>
        n === idx
          ? { ...i, quantidade_enviada: i.quantidade_enviada + qtd, preco_unitario: precoFinal }
          : i
      ))
    } else {
      setItens((prev) => [...prev, {
        produto_id: selected.id,
        nome: selected.nome,
        quantidade_enviada: qtd,
        preco_unitario: precoFinal,
      }])
    }

    setSelected(null)
    setQtdInput('1')
    setPrecoInput('0')
    setSearch('')
    setModalOpen(false)
  }

  function fecharModal() {
    setModalOpen(false)
    setSelected(null)
    setSearch('')
    setQtdInput('1')
    setPrecoInput('0')
  }

  function removerItem(produtoId: string) {
    setItens((prev) => prev.filter((i) => i.produto_id !== produtoId))
  }

  async function handleSubmit() {
    setError(null)
    if (itens.length === 0) { setError('Adicione pelo menos um item.'); return }
    if (tipo === 'DEVOLUCAO' && !observacao.trim()) { setError('Informe o motivo da devolução.'); return }
    if (!unidadeDestino || unidadeDestino.id === origemId) {
      setError('Selecione unidades de origem e destino diferentes.'); return
    }

    setLoading(true)
    const result = await createTransferenciaAction({
      empresa_id:         empresaId,
      unidade_origem_id:  origemId,
      unidade_destino_id: unidadeDestino.id,
      tipo,
      observacao:         observacao.trim() || undefined,
      itens: itens.map((i) => ({
        produto_id: i.produto_id,
        quantidade_enviada: i.quantidade_enviada,
        preco_unitario: i.preco_unitario,
      })),
    })
    setLoading(false)

    if (result.error) { setError(result.error); return }
    setSucesso(result.codigo ?? 'criada')
  }

  /* ── Sucesso ────────────────────────────────────────────────────────────── */
  if (sucesso) {
    return (
      <div className={`${CARD} p-10 flex flex-col items-center text-center gap-4`}>
        <div className="w-16 h-16 rounded-2xl bg-success-tint flex items-center justify-center">
          <Truck size={30} className="text-success" />
        </div>
        <div>
          <p className="font-playfair text-primary text-xl font-bold mb-1">{sucesso} em trânsito</p>
          <p className="text-secondary text-sm">A transferência foi registrada com sucesso.</p>
        </div>
        <button onClick={() => router.push('/dashboard/transferencias')} className={`${BTN_PRIMARY} mt-2`}>
          Ver transferências
        </button>
      </div>
    )
  }

  /* ── Formulário ─────────────────────────────────────────────────────────── */
  return (
    <div className="max-w-2xl space-y-5">

      {/* Toggle tipo */}
      <div className={`${CARD} p-6`}>
        <p className={LABEL}>Tipo de movimentação</p>
        <div className="inline-flex bg-input p-1 rounded-lg gap-1">
          {(['TRANSFERENCIA', 'DEVOLUCAO'] as const).map((t) => {
            const ativo = tipo === t
            const Icon  = t === 'TRANSFERENCIA' ? ArrowUpFromLine : ArrowDownToLine
            return (
              <button
                key={t}
                onClick={() => handleTipoChange(t)}
                className={`flex items-center gap-2 px-5 py-2 rounded-md text-sm font-medium transition-all ${
                  ativo ? 'bg-accent-primary text-accent-ink font-semibold shadow-sm' : 'text-secondary hover:text-ink-soft'
                }`}
              >
                <Icon size={14} />
                {t === 'TRANSFERENCIA' ? 'Transferência' : 'Devolução'}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-secondary mt-3">
          {tipo === 'DEVOLUCAO' ? 'Devolver produtos à unidade de origem.' : 'Enviar produtos para outra unidade.'}
        </p>
      </div>

      {/* Card ROTA */}
      <div className={`${CARD} p-6 space-y-4`}>
        <p className={LABEL}>Rota</p>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className={LABEL}>Origem</label>
            {isAutoRota ? (
              <div className={`${INPUT} opacity-60 cursor-default select-none`} title="Sua unidade">
                {unidadeOrigem?.nome ?? '—'}
              </div>
            ) : (
              <select value={origemId} onChange={(e) => setOrigemId(e.target.value)} className={INPUT}>
                {todasUnidades.map((u) => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
            )}
          </div>

          <div className="pb-1 shrink-0">
            <div className="w-10 h-10 rounded-full bg-input border border-subtle flex items-center justify-center">
              <ArrowRight size={17} className="text-accent-primary" />
            </div>
          </div>

          <div className="flex-1">
            <label className={LABEL}>Destino</label>
            <div
              className={`${INPUT} opacity-60 cursor-default select-none`}
              title={isAutoRota ? 'Definido automaticamente' : undefined}
            >
              {unidadeDestino?.nome ?? '—'}
            </div>
          </div>
        </div>

        {unidadeOrigem && unidadeDestino && unidadeOrigem.id !== unidadeDestino.id && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-tint text-accent-primary text-xs font-medium">
            <MapPin size={11} />
            {unidadeOrigem.nome}
            <ArrowRight size={11} />
            {unidadeDestino.nome}
          </span>
        )}
      </div>

      {/* Observação */}
      <div className={`${CARD} p-6`}>
        <label className={LABEL}>
          Observação
          {tipo === 'DEVOLUCAO' && <> — motivo da devolução <span className="text-danger normal-case font-normal">*</span></>}
        </label>
        <textarea
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder={tipo === 'DEVOLUCAO' ? 'Descreva o motivo da devolução...' : 'Observações opcionais...'}
          rows={3}
          className={`${INPUT} resize-none`}
        />
      </div>

      {/* Itens */}
      <div className={`${CARD} overflow-hidden`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-subtle">
          <p className="text-primary font-semibold text-base">
            Itens da transferência
            {itens.length > 0 && (
              <span className="ml-2 text-sm font-normal text-secondary">
                {itens.length} {itens.length === 1 ? 'item' : 'itens'}
              </span>
            )}
          </p>
          {itens.length > 0 && (
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-tint text-accent-primary text-sm font-medium hover:bg-accent-tint-hover transition-colors"
            >
              <Plus size={14} />
              Adicionar
            </button>
          )}
        </div>

        {itens.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-4 text-center px-6">
            <Package size={48} className="text-faint" />
            <div>
              <h4 className="text-ink-soft font-medium text-base">Nenhum produto nesta transferência</h4>
              <p className="text-faint text-sm mt-1 max-w-xs mx-auto">
                Adicione produtos para iniciar a movimentação
              </p>
            </div>
            <button onClick={() => setModalOpen(true)} className={BTN_PRIMARY}>
              <Plus size={15} />
              Adicionar produto
            </button>
          </div>
        ) : (
          <>
            {/* Cabeçalho da tabela */}
            <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-6 py-2 border-b border-subtle bg-canvas">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Produto</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary text-right w-20">Qtd</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary text-right w-28">Preço unit.</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary text-right w-28">Subtotal</span>
            </div>

            <div className="divide-y divide-subtle">
              {itens.map((item) => {
                const subtotal = item.quantidade_enviada * item.preco_unitario
                return (
                  <div
                    key={item.produto_id}
                    className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 px-6 py-3.5 hover:bg-input transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-primary truncate">{item.nome}</p>
                      <p className="text-xs text-secondary mt-0.5 sm:hidden">
                        {item.quantidade_enviada.toLocaleString('pt-BR')} ×{' '}
                        R$ {formatBRL(item.preco_unitario)} = R$ {formatBRL(subtotal)}
                      </p>
                    </div>
                    <span className="hidden sm:block text-sm text-secondary text-right w-20 tabular-nums">
                      {item.quantidade_enviada.toLocaleString('pt-BR')}
                    </span>
                    <span className="hidden sm:block text-sm text-secondary text-right w-28 tabular-nums">
                      R$ {formatBRL(item.preco_unitario)}
                    </span>
                    <span className="hidden sm:block text-sm font-medium text-primary text-right w-28 tabular-nums">
                      R$ {formatBRL(subtotal)}
                    </span>
                    <button
                      onClick={() => removerItem(item.produto_id)}
                      className="shrink-0 p-1.5 rounded-lg text-secondary hover:text-danger hover:bg-danger-tint transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Rodapé com valor total */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-subtle bg-canvas">
              <span className="text-xs font-semibold uppercase tracking-wider text-secondary">Valor total</span>
              <span className="font-playfair text-xl font-bold text-primary tabular-nums">
                R$ {formatBRL(valorTotal)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Erro */}
      {error && (
        <div className="bg-danger-tint border border-danger/30 text-danger rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Ações */}
      <div className="flex gap-3">
        <button onClick={() => router.back()} className={BTN_GHOST}>Cancelar</button>
        <button onClick={handleSubmit} disabled={loading || itens.length === 0} className={BTN_PRIMARY}>
          {loading && <Loader2 size={15} className="animate-spin" />}
          {loading ? 'Criando...' : 'Criar transferência'}
        </button>
      </div>

      {/* Modal de busca */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) fecharModal() }}
        >
          <div className="w-full max-w-[600px] flex flex-col max-h-[82vh] bg-surface border border-subtle rounded-xl shadow-2xl shadow-black/40">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-subtle shrink-0">
              <p className="text-base font-semibold text-primary">Adicionar produto</p>
              <button
                onClick={fecharModal}
                className="p-2 rounded-lg text-secondary hover:text-accent-primary hover:bg-accent-tint transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Busca */}
            <div className="px-6 pt-4 pb-2 shrink-0">
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar produto..."
                  autoFocus
                  className={`${INPUT} pl-9`}
                />
              </div>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto px-6 py-2 min-h-[160px]">
              {produtos.length === 0 ? (
                <div className="flex flex-col items-center py-12 gap-3 text-center">
                  <Package size={48} className="text-subtle" />
                  <div>
                    <h4 className="text-primary font-semibold text-base">Nenhum produto cadastrado</h4>
                    <p className="text-secondary text-sm mt-1 max-w-xs mx-auto">
                      Cadastre produtos em <span className="font-medium text-accent-primary">Insumos</span> antes de criar uma transferência.
                    </p>
                  </div>
                </div>
              ) : produtosFiltrados.length === 0 ? (
                <div className="flex flex-col items-center py-12 gap-3 text-center">
                  <SearchX size={48} className="text-subtle" />
                  <div>
                    <h4 className="text-primary font-semibold text-base">Nenhum produto encontrado</h4>
                    <p className="text-secondary text-sm mt-1">Tente buscar por outro nome</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-0.5 py-1">
                  {produtosFiltrados.slice(0, 80).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelected(p)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors text-sm ${
                        selected?.id === p.id
                          ? 'bg-accent-tint text-accent-primary font-medium'
                          : 'text-ink-soft hover:bg-input'
                      }`}
                    >
                      {p.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer com qtd, preço, subtotal */}
            <div className="shrink-0 px-6 py-4 border-t border-subtle space-y-3">
              {selected && (
                <p className="text-xs text-secondary">
                  Selecionado: <span className="font-semibold text-primary">{selected.nome}</span>
                </p>
              )}
              <div className="flex items-end gap-3 flex-wrap">
                <div>
                  <label className={LABEL}>Quantidade</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={qtdInput}
                    onChange={(e) => setQtdInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && selected) adicionarItem() }}
                    className={`${INPUT} w-24 text-center`}
                  />
                </div>
                <div>
                  <label className={LABEL}>Preço unit. (R$)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={precoInput}
                    onChange={(e) => setPrecoInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && selected) adicionarItem() }}
                    className={`${INPUT} w-28 text-center`}
                  />
                </div>
                {subtotalModal > 0 && (
                  <div className="pb-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-secondary mb-0.5">Subtotal</p>
                    <p className="font-playfair text-lg font-bold text-primary tabular-nums">
                      R$ {formatBRL(subtotalModal)}
                    </p>
                  </div>
                )}
                <button onClick={adicionarItem} disabled={!selected} className={`${BTN_PRIMARY} ml-auto`}>
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
