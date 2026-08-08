'use client'

import { useState, useMemo } from 'react'
import { Plus, X, ShoppingCart, Loader2, FileText, Paperclip, Trash2, TrendingUp } from 'lucide-react'
import { criarCompraAction, getInsumosParaCompra } from '@/app/actions/compra'
import { parseDecimalBR, formatBRL, formatData } from '@/lib/format'
import type { Compra, InsumoParaCompra, NovaCompraItemInput } from '../types'

interface LinhaItem {
  key: number
  /** Texto digitado; casado com o nome do insumo pelo datalist. */
  nome: string
  quantidade: string
  preco: string
  atualizarCusto: boolean
}

const INPUT =
  'w-full bg-input border border-subtle rounded-lg px-4 py-2.5 text-sm text-primary placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent-primary/40 focus:border-accent-primary transition-colors'

const LABEL = 'block text-xs font-medium uppercase tracking-wider text-secondary mb-1.5'


interface Props {
  compras: Compra[]
  unidadeId: string
}

export function ComprasTab({ compras: comprasIniciais, unidadeId }: Props) {
  const [compras, setCompras] = useState<Compra[]>(comprasIniciais)
  const [modalOpen, setModalOpen] = useState(false)

  // Campos do formulário
  const [fornecedor,  setFornecedor]  = useState('')
  const [dataCompra,  setDataCompra]  = useState(new Date().toISOString().split('T')[0])
  const [valorInput,  setValorInput]  = useState('')
  const [observacao,  setObservacao]  = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [aviso,       setAviso]       = useState<string | null>(null)

  // Itens da compra (opcionais). Detalhar permite reajustar o custo do insumo.
  const [insumos, setInsumos] = useState<InsumoParaCompra[]>([])
  const [linhas, setLinhas] = useState<LinhaItem[]>([])
  const keyRef = useState(() => ({ n: 0 }))[0]

  const insumoPorNome = useMemo(
    () => new Map(insumos.map((i) => [i.nome.trim().toLowerCase(), i])),
    [insumos],
  )
  function acharInsumo(nome: string): InsumoParaCompra | undefined {
    return insumoPorNome.get(nome.trim().toLowerCase())
  }

  // Soma dos itens: quando há itens, o valor total vem deles (não se digita duas vezes).
  const somaItens = useMemo(
    () => linhas.reduce((s, l) => s + (parseDecimalBR(l.quantidade) || 0) * (parseDecimalBR(l.preco) || 0), 0),
    [linhas],
  )

  async function abrirModal() {
    setModalOpen(true)
    if (insumos.length === 0) setInsumos(await getInsumosParaCompra(unidadeId))
  }

  function addLinha() {
    setLinhas((prev) => [...prev, { key: (keyRef.n += 1), nome: '', quantidade: '1', preco: '', atualizarCusto: true }])
  }
  function setLinha(key: number, patch: Partial<LinhaItem>) {
    setLinhas((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function resetForm() {
    setFornecedor('')
    setDataCompra(new Date().toISOString().split('T')[0])
    setValorInput('')
    setObservacao('')
    setLinhas([])
    setError(null)
  }

  function fecharModal() {
    setModalOpen(false)
    resetForm()
  }

  async function handleSalvar() {
    setError(null); setAviso(null)
    const temItens = linhas.length > 0
    // Com itens, o total é a soma deles; sem itens, o campo digitado.
    const valor = temItens ? somaItens : parseDecimalBR(valorInput)

    if (!fornecedor.trim())        { setError('Informe o fornecedor.'); return }
    if (!dataCompra)               { setError('Informe a data da compra.'); return }
    if (Number.isNaN(valor) || valor <= 0) {
      setError(temItens ? 'Preencha quantidade e preço dos itens.' : 'Informe um valor válido maior que zero.')
      return
    }

    const itens: NovaCompraItemInput[] = []
    for (const l of linhas) {
      const nome = l.nome.trim()
      if (!nome) { setError('Descreva todos os itens (ou remova as linhas vazias).'); return }
      const q = parseDecimalBR(l.quantidade)
      if (!q || q <= 0) { setError(`Informe a quantidade de "${nome}".`); return }
      const p = parseDecimalBR(l.preco)
      if (Number.isNaN(p) || p < 0) { setError(`Informe o preço de "${nome}".`); return }
      const ins = acharInsumo(nome)
      itens.push({
        insumo_id: ins?.id ?? null,
        descricao: nome,
        quantidade: q,
        preco_unitario: p,
        // Só reajusta insumo cadastrado que já tenha rendimento conhecido.
        atualizar_custo: !!ins && l.atualizarCusto && ins.qtd_uso_por_compra !== null,
      })
    }

    setLoading(true)
    const result = await criarCompraAction({
      unidade_id:  unidadeId,
      fornecedor:  fornecedor.trim(),
      data_compra: dataCompra,
      valor_total: valor,
      observacao:  observacao.trim() || undefined,
      itens:       itens.length > 0 ? itens : undefined,
    })
    setLoading(false)

    if (result.error) { setError(result.error); return }
    if (result.aviso) setAviso(result.aviso)

    // Adiciona otimisticamente à lista local
    const nova: Compra = {
      id:          crypto.randomUUID(),
      unidade_id:  unidadeId,
      fornecedor:  fornecedor.trim(),
      data_compra: dataCompra,
      valor_total: valor,
      observacao:  observacao.trim() || null,
      xml_url:     null,
      created_at:  new Date().toISOString(),
    }
    setCompras((prev) => [nova, ...prev])
    // Com aviso (ex.: insumo sem histórico de preço), o modal fica aberto para
    // a mensagem ser lida; sem aviso, fecha direto.
    if (result.aviso) { resetForm() } else { fecharModal() }
  }

  return (
    <div className="space-y-4">
      {/* Barra superior */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">
          {compras.length === 0
            ? 'Nenhuma compra registrada ainda.'
            : `${compras.length} compra${compras.length !== 1 ? 's' : ''} registrada${compras.length !== 1 ? 's' : ''}`}
        </p>
        <button
          onClick={abrirModal}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-primary hover:bg-accent-hover text-accent-ink text-sm font-semibold shadow-sm transition-colors"
        >
          <Plus size={14} />
          Nova Compra
        </button>
      </div>

      {/* Tabela de histórico */}
      {compras.length === 0 ? (
        <div className="bg-surface border border-subtle rounded-lg shadow-lg shadow-black/20 flex flex-col items-center py-16 text-center">
          <ShoppingCart size={40} className="mb-4 text-accent-primary/25" />
          <p className="font-medium text-primary text-base">Nenhuma compra registrada</p>
          <p className="text-sm text-secondary mt-1 max-w-xs mx-auto">
            Registre compras e notas fiscais para controle financeiro desta unidade.
          </p>
          <button
            onClick={abrirModal}
            className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent-primary hover:bg-accent-hover text-accent-ink text-sm font-semibold shadow-sm transition-colors"
          >
            <Plus size={14} />
            Nova Compra
          </button>
        </div>
      ) : (
        <div className="bg-surface border border-subtle rounded-lg shadow-lg shadow-black/20 overflow-hidden">
          {/* Cabeçalho */}
          <div className="hidden sm:grid grid-cols-[auto_1fr_auto_auto] gap-4 px-5 py-3 border-b border-subtle bg-canvas">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary w-24">Data</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Fornecedor</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary text-right w-28">Valor Total</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary w-8"></span>
          </div>

          <div className="divide-y divide-subtle">
            {compras.map((c) => (
              <div
                key={c.id}
                className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-5 py-4 hover:bg-input transition-colors"
              >
                {/* Data */}
                <div className="w-24 shrink-0">
                  <p className="text-sm font-medium text-ink-soft tabular-nums">{formatData(c.data_compra)}</p>
                </div>

                {/* Fornecedor + obs */}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary truncate">{c.fornecedor}</p>
                  {c.observacao && (
                    <p className="text-xs text-secondary mt-0.5 truncate">{c.observacao}</p>
                  )}
                </div>

                {/* Valor */}
                <div className="flex items-center justify-end gap-2 w-28 shrink-0">
                  {c.xml_url && (
                    <FileText size={13} className="text-accent-primary/60 shrink-0" />
                  )}
                  <span className="text-sm font-semibold text-primary tabular-nums">
                    R$ {formatBRL(c.valor_total)}
                  </span>
                </div>

                {/* Placeholder XML */}
                <div className="w-8 flex justify-end">
                  {!c.xml_url && (
                    <span
                      title="Anexar XML (em breve)"
                      className="p-1.5 rounded-lg text-faint cursor-not-allowed"
                    >
                      <Paperclip size={13} />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Nova Compra */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) fecharModal() }}
        >
          <div className="w-full max-w-[600px] max-h-[90vh] overflow-y-auto bg-surface border border-subtle rounded-xl shadow-2xl shadow-black/40 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-subtle">
              <div>
                <p className="text-base font-semibold text-primary">Nova Compra / NFe</p>
                <p className="text-xs text-secondary mt-0.5">Registro manual de compra ou nota fiscal</p>
              </div>
              <button
                onClick={fecharModal}
                className="p-2 rounded-lg text-secondary hover:text-accent-primary hover:bg-accent-tint transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Fornecedor */}
              <div>
                <label className={LABEL}>
                  Fornecedor <span className="text-danger normal-case font-normal">*</span>
                </label>
                <input
                  type="text"
                  value={fornecedor}
                  onChange={(e) => setFornecedor(e.target.value)}
                  placeholder="Nome do fornecedor"
                  autoFocus
                  className={INPUT}
                />
              </div>

              {/* Data + Valor na mesma linha */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>
                    Data <span className="text-danger normal-case font-normal">*</span>
                  </label>
                  <input
                    type="date"
                    value={dataCompra}
                    onChange={(e) => setDataCompra(e.target.value)}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label className={LABEL}>
                    Valor Total (R$) <span className="text-danger normal-case font-normal">*</span>
                  </label>
                  {linhas.length > 0 ? (
                    <div className={`${INPUT} flex items-center justify-between bg-canvas`}>
                      <span className="text-primary font-semibold tabular-nums">R$ {formatBRL(somaItens)}</span>
                      <span className="text-[11px] text-faint">soma dos itens</span>
                    </div>
                  ) : (
                    <input
                      type="text"
                      inputMode="decimal"
                      value={valorInput}
                      onChange={(e) => setValorInput(e.target.value)}
                      placeholder="0,00"
                      className={INPUT}
                    />
                  )}
                </div>
              </div>

              {/* Itens — opcionais. É o que transforma a compra em reajuste de custo. */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={`${LABEL} mb-0`}>
                    Itens <span className="normal-case font-normal text-faint">(opcional)</span>
                  </label>
                  <button
                    type="button"
                    onClick={addLinha}
                    className="text-xs text-accent-primary hover:underline inline-flex items-center gap-1"
                  >
                    <Plus size={12} /> Adicionar item
                  </button>
                </div>

                {linhas.length === 0 ? (
                  <p className="text-xs text-faint bg-canvas border border-dashed border-subtle rounded-lg px-3 py-2.5">
                    Detalhe os itens para <strong className="text-secondary">atualizar o custo dos insumos</strong> com
                    o preço que você pagou de verdade.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <datalist id="insumos-compra">
                      {insumos.map((i) => <option key={i.id} value={i.nome} />)}
                    </datalist>

                    {linhas.map((l) => {
                      const ins = acharInsumo(l.nome)
                      const novoPreco = parseDecimalBR(l.preco)
                      const mudouPreco =
                        !!ins && ins.preco_atual !== null && novoPreco > 0 &&
                        Math.abs(ins.preco_atual - novoPreco) >= 0.01
                      return (
                        <div key={l.key} className="bg-canvas border border-subtle rounded-lg p-2.5 space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              list="insumos-compra"
                              value={l.nome}
                              onChange={(e) => setLinha(l.key, { nome: e.target.value })}
                              placeholder="Insumo ou descrição do item"
                              className={`${INPUT} py-1.5 text-sm flex-1`}
                              aria-label="Item da compra"
                            />
                            <button
                              type="button"
                              onClick={() => setLinhas((prev) => prev.filter((x) => x.key !== l.key))}
                              className="p-2 rounded-lg text-secondary hover:text-danger hover:bg-danger-tint transition-colors shrink-0"
                              aria-label="Remover item"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          <div className="flex gap-2 items-center">
                            <input
                              type="text" inputMode="decimal" value={l.quantidade}
                              onChange={(e) => setLinha(l.key, { quantidade: e.target.value })}
                              placeholder="Qtd" className={`${INPUT} py-1.5 text-sm w-20`}
                              aria-label="Quantidade"
                            />
                            <span className="text-faint text-xs">×</span>
                            <input
                              type="text" inputMode="decimal" value={l.preco}
                              onChange={(e) => setLinha(l.key, { preco: e.target.value })}
                              placeholder="Preço un." className={`${INPUT} py-1.5 text-sm w-28`}
                              aria-label="Preço unitário"
                            />
                            <span className="text-secondary text-xs tabular-nums ml-auto">
                              R$ {formatBRL((parseDecimalBR(l.quantidade) || 0) * (parseDecimalBR(l.preco) || 0))}
                            </span>
                          </div>

                          {/* Reajuste: só faz sentido com insumo cadastrado e rendimento conhecido */}
                          {ins && ins.qtd_uso_por_compra !== null && (
                            <label className="flex items-start gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={l.atualizarCusto}
                                onChange={(e) => setLinha(l.key, { atualizarCusto: e.target.checked })}
                                className="mt-0.5 accent-[var(--t-accent)]"
                              />
                              <span className="text-[11px] text-secondary leading-snug">
                                Atualizar o custo deste insumo
                                {mudouPreco && (
                                  <span className="text-accent-primary font-medium inline-flex items-center gap-1 ml-1">
                                    <TrendingUp size={10} />
                                    R$ {formatBRL(ins.preco_atual!)} → R$ {formatBRL(novoPreco)}
                                  </span>
                                )}
                                {ins.unidade_compra && (
                                  <span className="text-faint block">por {ins.unidade_compra}</span>
                                )}
                              </span>
                            </label>
                          )}
                          {ins && ins.qtd_uso_por_compra === null && (
                            <p className="text-[11px] text-faint">
                              Sem preço cadastrado ainda — lance o primeiro na tela de Insumos para poder reajustar por aqui.
                            </p>
                          )}
                          {!ins && l.nome.trim() && (
                            <p className="text-[11px] text-faint">Item avulso (não é um insumo cadastrado).</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Observação */}
              <div>
                <label className={LABEL}>Observação</label>
                <textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Número da NF, lote, detalhes..."
                  rows={2}
                  className={`${INPUT} resize-none`}
                />
              </div>

              {/* Anexar XML — só visual */}
              <div>
                <label className={LABEL}>
                  Anexar XML{' '}
                  <span className="normal-case font-normal text-faint">(em breve)</span>
                </label>
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed border-subtle bg-canvas cursor-not-allowed opacity-50">
                  <Paperclip size={15} className="text-secondary shrink-0" />
                  <span className="text-sm text-secondary">Clique para selecionar arquivo XML</span>
                </div>
              </div>

              {/* Erro / aviso */}
              {error && (
                <p className="text-sm text-danger bg-danger-tint rounded-lg px-3 py-2">{error}</p>
              )}
              {aviso && (
                <p className="text-sm text-primary bg-accent-tint rounded-lg px-3 py-2">{aviso}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-subtle">
              <button
                onClick={fecharModal}
                className="px-5 py-2.5 rounded-lg bg-transparent border border-subtle text-ink-soft hover:bg-input hover:text-primary text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent-primary hover:bg-accent-hover text-accent-ink text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {loading ? 'Salvando...' : 'Registrar Compra'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
