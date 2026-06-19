'use client'

import { useState, useOptimistic } from 'react'
import { Plus, X, ShoppingCart, Loader2, FileText, Paperclip } from 'lucide-react'
import { criarCompraAction } from '@/app/actions/compra'
import { parseDecimalBR, formatBRL } from '@/lib/format'
import type { Compra } from '../types'

const INPUT =
  'w-full bg-input border border-subtle rounded-lg px-4 py-2.5 text-sm text-primary placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent-primary/40 focus:border-accent-primary transition-colors'

const LABEL = 'block text-xs font-medium uppercase tracking-wider text-secondary mb-1.5'

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

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

  function resetForm() {
    setFornecedor('')
    setDataCompra(new Date().toISOString().split('T')[0])
    setValorInput('')
    setObservacao('')
    setError(null)
  }

  function fecharModal() {
    setModalOpen(false)
    resetForm()
  }

  async function handleSalvar() {
    setError(null)
    const valor = parseDecimalBR(valorInput)
    if (!fornecedor.trim())        { setError('Informe o fornecedor.'); return }
    if (!dataCompra)               { setError('Informe a data da compra.'); return }
    if (Number.isNaN(valor) || valor <= 0) { setError('Informe um valor válido maior que zero.'); return }

    setLoading(true)
    const result = await criarCompraAction({
      unidade_id:  unidadeId,
      fornecedor:  fornecedor.trim(),
      data_compra: dataCompra,
      valor_total: valor,
      observacao:  observacao.trim() || undefined,
    })
    setLoading(false)

    if (result.error) { setError(result.error); return }

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
    fecharModal()
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
          onClick={() => setModalOpen(true)}
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
            onClick={() => setModalOpen(true)}
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
                  <p className="text-sm font-medium text-ink-soft tabular-nums">{formatDate(c.data_compra)}</p>
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
          <div className="w-full max-w-[520px] bg-surface border border-subtle rounded-xl shadow-2xl shadow-black/40 flex flex-col">
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
                  <input
                    type="text"
                    inputMode="decimal"
                    value={valorInput}
                    onChange={(e) => setValorInput(e.target.value)}
                    placeholder="0,00"
                    className={INPUT}
                  />
                </div>
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

              {/* Erro */}
              {error && (
                <p className="text-sm text-danger bg-danger-tint rounded-lg px-3 py-2">{error}</p>
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
