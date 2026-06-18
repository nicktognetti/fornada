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

/* ── Classes utilitárias locais ─────────────────────────────────────────────── */
const CLS_BTN_PRIMARY =
  'inline-flex items-center gap-2 bg-[#c2410c] hover:bg-[#d97747] text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border-none'

const CLS_BTN_GHOST =
  'inline-flex items-center gap-2 bg-white border border-[#e5ddd3] text-[#44403c] hover:bg-[#faf7f4] hover:border-[#d5c9bd] font-medium px-5 py-2.5 rounded-lg text-sm transition-colors cursor-pointer'

const CLS_INPUT =
  'w-full bg-[#fefefe] border border-[#e5ddd3] rounded-lg px-4 py-2.5 text-sm text-[#1c1917] placeholder:text-[#a8a29a] focus:outline-none focus:ring-2 focus:ring-[#d97747]/30 focus:border-[#d97747] transition-colors'

const CLS_LABEL =
  'block text-[11px] font-semibold uppercase tracking-wider text-[#78716c] mb-1.5'

interface Props {
  unidades: Unidade[]
  produtos:  Produto[]
  empresaId: string
}

export function NovaTransferenciaForm({ unidades, produtos, empresaId }: Props) {
  const router = useRouter()
  const doisUnidades = unidades.length === 2

  const [tipo,       setTipo]       = useState<'TRANSFERENCIA' | 'DEVOLUCAO'>('TRANSFERENCIA')
  const [origemId,   setOrigemId]   = useState(unidades[0]?.id ?? '')
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
      setItens((prev) =>
        prev.map((i, n) => n === idx ? { ...i, quantidade_enviada: i.quantidade_enviada + qtd } : i)
      )
    } else {
      setItens((prev) => [
        ...prev,
        { produto_id: selected.id, nome: selected.nome, quantidade_enviada: qtd },
      ])
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
      <div className="bg-white border border-[#e5ddd3] rounded-lg shadow-md p-10 flex flex-col items-center text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-[#dcfce7] flex items-center justify-center">
          <Truck size={30} className="text-[#166534]" />
        </div>
        <div>
          <p className="font-playfair text-[#1c1917] text-xl font-bold mb-1">{sucesso} em trânsito</p>
          <p className="text-[#78716c] text-sm">A transferência foi registrada com sucesso.</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/transferencias')}
          className={`${CLS_BTN_PRIMARY} mt-2`}
        >
          Ver transferências
        </button>
      </div>
    )
  }

  /* ── Formulário ─────────────────────────────────────────────────────────── */
  return (
    <div className="max-w-2xl space-y-5">

      {/* Toggle tipo */}
      <div className="bg-white border border-[#e5ddd3] rounded-lg shadow-md p-6">
        <p className={CLS_LABEL}>Tipo de movimentação</p>

        <div className="inline-flex bg-[#e5ddd3]/50 p-1 rounded-lg gap-1">
          {(['TRANSFERENCIA', 'DEVOLUCAO'] as const).map((t) => {
            const ativo = tipo === t
            const Icon  = t === 'TRANSFERENCIA' ? ArrowUpFromLine : ArrowDownToLine
            return (
              <button
                key={t}
                onClick={() => handleTipoChange(t)}
                className={`flex items-center gap-2 px-5 py-2 rounded-md text-sm font-medium transition-all ${
                  ativo
                    ? 'bg-white shadow-sm text-[#c2410c] font-semibold'
                    : 'bg-transparent text-[#78716c] hover:text-[#44403c]'
                }`}
              >
                <Icon size={14} />
                {t === 'TRANSFERENCIA' ? 'Transferência' : 'Devolução'}
              </button>
            )
          })}
        </div>

        <p className="text-xs text-[#78716c] mt-3">
          {tipo === 'DEVOLUCAO'
            ? 'Devolver produtos à unidade de origem.'
            : 'Enviar produtos para outra unidade.'}
        </p>
      </div>

      {/* Card ROTA */}
      <div className="bg-white border border-[#e5ddd3] rounded-lg shadow-md p-6 space-y-4">
        <p className={CLS_LABEL}>Rota</p>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className={CLS_LABEL}>Origem</label>
            <select
              value={origemId}
              onChange={(e) => setOrigemId(e.target.value)}
              className={CLS_INPUT}
            >
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          </div>

          <div className="pb-1 shrink-0">
            <div className="w-10 h-10 rounded-full bg-[#faf7f4] border border-[#e5ddd3] flex items-center justify-center">
              <ArrowRight size={17} className="text-[#c2410c]" />
            </div>
          </div>

          <div className="flex-1">
            <label className={CLS_LABEL}>Destino</label>
            <div
              className={`${CLS_INPUT} opacity-60 cursor-default select-none`}
              title={doisUnidades ? 'Definido automaticamente' : undefined}
            >
              {unidadeDestino?.nome ?? '—'}
            </div>
          </div>
        </div>

        {unidadeOrigem && unidadeDestino && unidadeOrigem.id !== unidadeDestino.id && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fff7ed] text-[#9a3412] text-xs font-medium">
            <MapPin size={11} />
            {unidadeOrigem.nome}
            <ArrowRight size={11} />
            {unidadeDestino.nome}
          </span>
        )}
      </div>

      {/* Observação */}
      <div className="bg-white border border-[#e5ddd3] rounded-lg shadow-md p-6">
        <label className={CLS_LABEL}>
          Observação
          {tipo === 'DEVOLUCAO' && (
            <> — motivo da devolução <span className="text-[#991b1b] normal-case font-normal">*</span></>
          )}
        </label>
        <textarea
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder={
            tipo === 'DEVOLUCAO'
              ? 'Descreva o motivo da devolução...'
              : 'Observações opcionais...'
          }
          rows={3}
          className={`${CLS_INPUT} resize-none`}
        />
      </div>

      {/* Itens */}
      <div className="bg-white border border-[#e5ddd3] rounded-lg shadow-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5ddd3]">
          <p className="text-[#1c1917] font-semibold text-base">
            Itens da transferência
            {itens.length > 0 && (
              <span className="ml-2 text-sm font-normal text-[#78716c]">
                {itens.length} {itens.length === 1 ? 'item' : 'itens'}
              </span>
            )}
          </p>
          {itens.length > 0 && (
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#fff7ed] text-[#c2410c] text-sm font-medium hover:bg-[#ffedd5] transition-colors"
            >
              <Plus size={14} />
              Adicionar
            </button>
          )}
        </div>

        {itens.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-4 text-center px-6">
            <Package size={56} className="text-[#e5ddd3]" />
            <div>
              <h4 className="text-[#1c1917] font-semibold text-base">
                Nenhum produto nesta transferência
              </h4>
              <p className="text-[#78716c] text-sm mt-1 max-w-xs mx-auto">
                Busque e adicione os produtos que serão transferidos entre as unidades
              </p>
            </div>
            <button onClick={() => setModalOpen(true)} className={CLS_BTN_PRIMARY}>
              <Plus size={15} />
              Adicionar produto
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#e5ddd3]">
            {itens.map((item) => (
              <div
                key={item.produto_id}
                className="flex items-center justify-between gap-3 px-6 py-3.5 hover:bg-[#faf7f4] transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#1c1917] truncate">{item.nome}</p>
                  <p className="text-xs text-[#78716c] mt-0.5">
                    {item.quantidade_enviada.toLocaleString('pt-BR')} unid.
                  </p>
                </div>
                <button
                  onClick={() => removerItem(item.produto_id)}
                  className="shrink-0 p-1.5 rounded-lg text-[#a8a29a] hover:text-[#991b1b] hover:bg-[#fee2e2] transition-colors"
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
        <div className="bg-[#fee2e2] border border-[#991b1b]/20 text-[#991b1b] rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Ações */}
      <div className="flex gap-3">
        <button onClick={() => router.back()} className={CLS_BTN_GHOST}>
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading || itens.length === 0}
          className={CLS_BTN_PRIMARY}
        >
          {loading && <Loader2 size={15} className="animate-spin" />}
          {loading ? 'Criando...' : 'Criar transferência'}
        </button>
      </div>

      {/* Modal de busca */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) fecharModal() }}
        >
          <div className="w-full max-w-[600px] flex flex-col max-h-[82vh] bg-white rounded-xl shadow-xl border border-[#e5ddd3]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#e5ddd3] shrink-0">
              <p className="text-base font-semibold text-[#1c1917]">Adicionar produto</p>
              <button
                onClick={fecharModal}
                className="p-2 rounded-lg text-[#78716c] hover:text-[#c2410c] hover:bg-[#fff7ed] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Busca */}
            <div className="px-6 pt-4 pb-2 shrink-0">
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a8a29a] pointer-events-none"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar produto..."
                  autoFocus
                  className={`${CLS_INPUT} pl-9`}
                />
              </div>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto px-6 py-2 min-h-[160px]">
              {produtos.length === 0 ? (
                <div className="flex flex-col items-center py-12 gap-3 text-center">
                  <Package size={48} className="text-[#e5ddd3]" />
                  <div>
                    <h4 className="text-[#1c1917] font-semibold text-base">Nenhum produto cadastrado</h4>
                    <p className="text-[#78716c] text-sm mt-1 max-w-xs mx-auto">
                      Cadastre produtos em{' '}
                      <span className="font-medium text-[#c2410c]">Insumos</span>{' '}
                      antes de criar uma transferência.
                    </p>
                  </div>
                </div>
              ) : produtosFiltrados.length === 0 ? (
                <div className="flex flex-col items-center py-12 gap-3 text-center">
                  <SearchX size={48} className="text-[#e5ddd3]" />
                  <div>
                    <h4 className="text-[#1c1917] font-semibold text-base">Nenhum produto encontrado</h4>
                    <p className="text-[#78716c] text-sm mt-1">Tente buscar por outro nome</p>
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
                          ? 'bg-[#fff7ed] text-[#c2410c] font-medium'
                          : 'text-[#1c1917] hover:bg-[#faf7f4]'
                      }`}
                    >
                      {p.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 px-6 py-4 border-t border-[#e5ddd3]">
              {selected && (
                <p className="text-xs text-[#78716c] mb-3">
                  Selecionado:{' '}
                  <span className="font-semibold text-[#1c1917]">{selected.nome}</span>
                </p>
              )}
              <div className="flex justify-end items-end gap-4">
                <div>
                  <label className={CLS_LABEL}>Quantidade</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={qtdInput}
                    onChange={(e) => setQtdInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && selected) adicionarItem() }}
                    className={`${CLS_INPUT} w-24 text-center`}
                  />
                </div>
                <button
                  onClick={adicionarItem}
                  disabled={!selected}
                  className={CLS_BTN_PRIMARY}
                >
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
