'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  X, Plus, Search, Package, ArrowRight, Loader2, Truck,
  ArrowUpFromLine, ArrowDownToLine, MapPin, SearchX,
} from 'lucide-react'
import { createTransferenciaAction } from '@/app/actions/transferencia'
import { normalizeSearch } from '@/lib/format'

type Unidade = { id: string; nome: string }
type Produto  = { id: string; nome: string }
type ItemForm = { produto_id: string; nome: string; quantidade_enviada: number }

/* ── Dark-theme class constants ─────────────────────────────────────────────── */
const BTN_PRIMARY =
  'inline-flex items-center gap-2 bg-[#d98d5f] hover:bg-[#e8a57a] text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border-none'

const BTN_GHOST =
  'inline-flex items-center gap-2 bg-transparent border border-[#333336] text-[#d4d4d0] hover:bg-[#2a2a2e] hover:text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors cursor-pointer'

const INPUT =
  'w-full bg-[#2a2a2e] border border-[#333336] rounded-lg px-4 py-2.5 text-sm text-[#f5f5f0] placeholder:text-[#666666] focus:outline-none focus:ring-2 focus:ring-[#d98d5f]/40 focus:border-[#d98d5f] transition-colors'

const LABEL = 'block text-xs font-medium uppercase tracking-wider text-[#888888] mb-1.5'

const CARD = 'bg-[#222226] border border-[#333336] rounded-lg shadow-lg shadow-black/20'

interface Props {
  unidades: Unidade[]
  produtos:  Produto[]
  empresaId: string
  unidadeUsuarioId?: string | null
}

export function NovaTransferenciaForm({ unidades, produtos, empresaId, unidadeUsuarioId }: Props) {
  const router = useRouter()
  const doisUnidades = unidades.length === 2

  // Auto-rota: exatamente 2 unidades e sabemos qual é a do usuário
  const isAutoRota =
    doisUnidades &&
    !!unidadeUsuarioId &&
    unidades.some((u) => u.id === unidadeUsuarioId)

  const origemDefault = isAutoRota ? (unidadeUsuarioId as string) : (unidades[0]?.id ?? '')

  const [tipo,       setTipo]       = useState<'TRANSFERENCIA' | 'DEVOLUCAO'>('TRANSFERENCIA')
  const [origemId,   setOrigemId]   = useState(origemDefault)
  const [observacao, setObservacao] = useState('')
  const [itens,      setItens]      = useState<ItemForm[]>([])
  const [modalOpen,  setModalOpen]  = useState(false)
  const [search,     setSearch]     = useState('')
  const [selected,   setSelected]   = useState<Produto | null>(null)
  const [qtdInput,   setQtdInput]   = useState('1')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [sucesso,    setSucesso]    = useState<string | null>(null)

  const unidadeOrigem  = unidades.find((u) => u.id === origemId) ?? unidades[0]
  const unidadeDestino = unidades.find((u) => u.id !== origemId) ?? unidades[1] ?? unidades[0]

  function handleTipoChange(novoTipo: 'TRANSFERENCIA' | 'DEVOLUCAO') {
    if (novoTipo !== tipo && doisUnidades && unidadeDestino) {
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
    const qtd = parseFloat(qtdInput.replace(',', '.'))
    if (!qtd || qtd <= 0) return

    const idx = itens.findIndex((i) => i.produto_id === selected.id)
    if (idx >= 0) {
      setItens((prev) => prev.map((i, n) => n === idx ? { ...i, quantidade_enviada: i.quantidade_enviada + qtd } : i))
    } else {
      setItens((prev) => [...prev, { produto_id: selected.id, nome: selected.nome, quantidade_enviada: qtd }])
    }

    setSelected(null)
    setQtdInput('1')
    setSearch('')
    setModalOpen(false)
  }

  function fecharModal() {
    setModalOpen(false)
    setSelected(null)
    setSearch('')
    setQtdInput('1')
  }

  function removerItem(produtoId: string) {
    setItens((prev) => prev.filter((i) => i.produto_id !== produtoId))
  }

  async function handleSubmit() {
    setError(null)
    if (itens.length === 0) { setError('Adicione pelo menos um item.'); return }
    if (tipo === 'DEVOLUCAO' && !observacao.trim()) { setError('Informe o motivo da devolução.'); return }

    setLoading(true)
    const result = await createTransferenciaAction({
      empresa_id:         empresaId,
      unidade_origem_id:  origemId,
      unidade_destino_id: unidadeDestino?.id ?? '',
      tipo,
      observacao:         observacao.trim() || undefined,
      itens: itens.map((i) => ({ produto_id: i.produto_id, quantidade_enviada: i.quantidade_enviada })),
    })
    setLoading(false)

    if (result.error) { setError(result.error); return }
    setSucesso(result.codigo ?? 'criada')
  }

  /* ── Sucesso ────────────────────────────────────────────────────────────── */
  if (sucesso) {
    return (
      <div className={`${CARD} p-10 flex flex-col items-center text-center gap-4`}>
        <div className="w-16 h-16 rounded-2xl bg-[#1e2a1e] flex items-center justify-center">
          <Truck size={30} className="text-[#5f9a5f]" />
        </div>
        <div>
          <p className="font-playfair text-[#f5f5f0] text-xl font-bold mb-1">{sucesso} em trânsito</p>
          <p className="text-[#888888] text-sm">A transferência foi registrada com sucesso.</p>
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
        <div className="inline-flex bg-[#2a2a2e] p-1 rounded-lg gap-1">
          {(['TRANSFERENCIA', 'DEVOLUCAO'] as const).map((t) => {
            const ativo = tipo === t
            const Icon  = t === 'TRANSFERENCIA' ? ArrowUpFromLine : ArrowDownToLine
            return (
              <button
                key={t}
                onClick={() => handleTipoChange(t)}
                className={`flex items-center gap-2 px-5 py-2 rounded-md text-sm font-medium transition-all ${
                  ativo ? 'bg-[#d98d5f] text-white font-semibold shadow-sm' : 'text-[#888888] hover:text-[#d4d4d0]'
                }`}
              >
                <Icon size={14} />
                {t === 'TRANSFERENCIA' ? 'Transferência' : 'Devolução'}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-[#888888] mt-3">
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
              <div
                className={`${INPUT} opacity-60 cursor-default select-none`}
                title="Sua unidade"
              >
                {unidadeOrigem?.nome ?? '—'}
              </div>
            ) : (
              <select value={origemId} onChange={(e) => setOrigemId(e.target.value)} className={INPUT}>
                {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            )}
          </div>

          <div className="pb-1 shrink-0">
            <div className="w-10 h-10 rounded-full bg-[#2a2a2e] border border-[#333336] flex items-center justify-center">
              <ArrowRight size={17} className="text-[#d98d5f]" />
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2a2a1e] text-[#d9a05f] text-xs font-medium">
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
          {tipo === 'DEVOLUCAO' && <> — motivo da devolução <span className="text-[#c74a4a] normal-case font-normal">*</span></>}
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#333336]">
          <p className="text-[#f5f5f0] font-semibold text-base">
            Itens da transferência
            {itens.length > 0 && (
              <span className="ml-2 text-sm font-normal text-[#888888]">
                {itens.length} {itens.length === 1 ? 'item' : 'itens'}
              </span>
            )}
          </p>
          {itens.length > 0 && (
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2a2a1e] text-[#d9a05f] text-sm font-medium hover:bg-[#333320] transition-colors"
            >
              <Plus size={14} />
              Adicionar
            </button>
          )}
        </div>

        {itens.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-4 text-center px-6">
            <Package size={48} className="text-[#444444]" />
            <div>
              <h4 className="text-[#d4d4d0] font-medium text-base">Nenhum produto nesta transferência</h4>
              <p className="text-[#666666] text-sm mt-1 max-w-xs mx-auto">
                Adicione produtos para iniciar a movimentação
              </p>
            </div>
            <button onClick={() => setModalOpen(true)} className={BTN_PRIMARY}>
              <Plus size={15} />
              Adicionar produto
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#333336]">
            {itens.map((item) => (
              <div
                key={item.produto_id}
                className="flex items-center justify-between gap-3 px-6 py-3.5 hover:bg-[#2a2a2e] transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#f5f5f0] truncate">{item.nome}</p>
                  <p className="text-xs text-[#888888] mt-0.5">{item.quantidade_enviada.toLocaleString('pt-BR')} unid.</p>
                </div>
                <button
                  onClick={() => removerItem(item.produto_id)}
                  className="shrink-0 p-1.5 rounded-lg text-[#888888] hover:text-[#c74a4a] hover:bg-[#2a1e1e] transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Erro */}
      {error && (
        <div className="bg-[#2a1e1e] border border-[#c74a4a]/30 text-[#c74a4a] rounded-lg px-4 py-3 text-sm">
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
          <div className="w-full max-w-[600px] flex flex-col max-h-[82vh] bg-[#222226] border border-[#333336] rounded-xl shadow-2xl shadow-black/40">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#333336] shrink-0">
              <p className="text-base font-semibold text-[#f5f5f0]">Adicionar produto</p>
              <button
                onClick={fecharModal}
                className="p-2 rounded-lg text-[#888888] hover:text-[#d98d5f] hover:bg-[#2a2a1e] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Busca */}
            <div className="px-6 pt-4 pb-2 shrink-0">
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#666666] pointer-events-none" />
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
                  <Package size={48} className="text-[#333336]" />
                  <div>
                    <h4 className="text-[#f5f5f0] font-semibold text-base">Nenhum produto cadastrado</h4>
                    <p className="text-[#888888] text-sm mt-1 max-w-xs mx-auto">
                      Cadastre produtos em <span className="font-medium text-[#d98d5f]">Insumos</span> antes de criar uma transferência.
                    </p>
                  </div>
                </div>
              ) : produtosFiltrados.length === 0 ? (
                <div className="flex flex-col items-center py-12 gap-3 text-center">
                  <SearchX size={48} className="text-[#333336]" />
                  <div>
                    <h4 className="text-[#f5f5f0] font-semibold text-base">Nenhum produto encontrado</h4>
                    <p className="text-[#888888] text-sm mt-1">Tente buscar por outro nome</p>
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
                          ? 'bg-[#2a2a1e] text-[#d98d5f] font-medium'
                          : 'text-[#d4d4d0] hover:bg-[#2a2a2e]'
                      }`}
                    >
                      {p.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 px-6 py-4 border-t border-[#333336]">
              {selected && (
                <p className="text-xs text-[#888888] mb-3">
                  Selecionado: <span className="font-semibold text-[#f5f5f0]">{selected.nome}</span>
                </p>
              )}
              <div className="flex justify-end items-end gap-4">
                <div>
                  <label className={LABEL}>Quantidade</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={qtdInput}
                    onChange={(e) => setQtdInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && selected) adicionarItem() }}
                    className={`${INPUT} w-24 text-center`}
                  />
                </div>
                <button onClick={adicionarItem} disabled={!selected} className={BTN_PRIMARY}>
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
