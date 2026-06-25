'use client'

import { useState } from 'react'
import { X, CheckCircle, Loader2, AlertTriangle } from 'lucide-react'
import { confirmarRecebimentoAction } from '@/app/actions/transferencia'
import { parseDecimalBR, formatBRL } from '@/lib/format'

type ItemInput = {
  id: string
  produto_nome: string
  quantidade_enviada: number
  preco_unitario: number
}

type ItemConferencia = {
  id: string
  produto_nome: string
  quantidade_enviada: number
  preco_unitario: number
  quantidade_recebida: string
  status_item: 'RECEBIDO' | 'DIFERENCA' | 'AUSENTE'
  motivo_divergencia: string
}

interface Props {
  transferenciaId: string
  userId: string
  itens: ItemInput[]
  isAdmin?: boolean
  onClose: () => void
  onSuccess: () => void
}

const CLS_INPUT =
  'w-full bg-input border border-subtle rounded-lg px-3.5 py-2 text-sm text-primary placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent-primary/40 focus:border-accent-primary transition-colors'

export function ConfirmacaoDrawer({ transferenciaId, userId, itens, isAdmin = false, onClose, onSuccess }: Props) {
  const [conferencia, setConferencia] = useState<ItemConferencia[]>(() =>
    itens.map((i) => ({
      id: i.id,
      produto_nome: i.produto_nome,
      quantidade_enviada: i.quantidade_enviada,
      preco_unitario: i.preco_unitario,
      quantidade_recebida: String(i.quantidade_enviada).replace('.', ','),
      status_item: 'RECEBIDO',
      motivo_divergencia: '',
    }))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function marcarRecebido(id: string) {
    setConferencia((prev) => prev.map((i) =>
      i.id === id
        ? {
            ...i,
            status_item: 'RECEBIDO',
            quantidade_recebida: String(i.quantidade_enviada).replace('.', ','),
            motivo_divergencia: '',
          }
        : i
    ))
  }

  function marcarDivergencia(id: string) {
    setConferencia((prev) => prev.map((i) =>
      i.id === id ? { ...i, status_item: 'DIFERENCA' } : i
    ))
  }

  function marcarAusente(id: string) {
    setConferencia((prev) => prev.map((i) =>
      i.id === id ? { ...i, status_item: 'AUSENTE', quantidade_recebida: '0' } : i
    ))
  }

  function handleQtdChange(id: string, qtdStr: string) {
    setConferencia((prev) => prev.map((i) => {
      if (i.id !== id) return i
      const qtd = parseDecimalBR(qtdStr) ?? -1
      const autoStatus: ItemConferencia['status_item'] =
        qtd === 0                                      ? 'AUSENTE'   :
        qtd !== i.quantidade_enviada && qtd > 0        ? 'DIFERENCA' :
                                                         'RECEBIDO'
      return { ...i, quantidade_recebida: qtdStr, status_item: autoStatus }
    }))
  }

  function updateMotivo(id: string, motivo: string) {
    setConferencia((prev) => prev.map((i) => (i.id === id ? { ...i, motivo_divergencia: motivo } : i)))
  }

  async function handleFinalizar() {
    setError(null)
    const semMotivo = conferencia.find(
      (i) => i.status_item === 'DIFERENCA' && !i.motivo_divergencia.trim()
    )
    if (semMotivo) {
      setError(`Informe o motivo da divergência para: ${semMotivo.produto_nome}`)
      return
    }

    setLoading(true)
    const result = await confirmarRecebimentoAction({
      transferencia_id: transferenciaId,
      responsavel_destino_id: userId,
      itens: conferencia.map((i) => {
        const qtd = parseDecimalBR(i.quantidade_recebida)
        return {
          id: i.id,
          quantidade_recebida: Number.isNaN(qtd) ? 0 : qtd,
          status_item: i.status_item,
          motivo_divergencia: i.motivo_divergencia.trim() || undefined,
        }
      }),
    })
    setLoading(false)

    if (result.error) { setError(result.error); return }
    onSuccess()
  }

  const divergentes = conferencia.filter((i) => i.status_item !== 'RECEBIDO').length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-[580px] max-h-[90vh] bg-surface border border-subtle rounded-xl flex flex-col shadow-2xl shadow-black/40">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-subtle">
          <div>
            <p className="text-base font-semibold text-primary">Confirmar recebimento</p>
            <p className="text-xs text-secondary mt-0.5">
              {divergentes > 0
                ? `${divergentes} item${divergentes > 1 ? 's' : ''} com divergência`
                : 'Marque divergências se algo não chegou conforme'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-secondary hover:text-accent-primary hover:bg-accent-tint transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Itens */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {conferencia.map((item) => {
            const expanded = item.status_item !== 'RECEBIDO'
            const subtotal = item.quantidade_enviada * item.preco_unitario

            return (
              <div
                key={item.id}
                className={`border rounded-xl transition-all ${
                  expanded ? 'bg-danger-tint/20 border-danger/30' : 'bg-input border-subtle'
                }`}
              >
                {/* Linha principal — sempre visível */}
                <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-primary">{item.produto_nome}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p className="text-xs text-secondary">
                        Enviado: <span className="font-medium text-ink-soft">{item.quantidade_enviada.toLocaleString('pt-BR')} un</span>
                      </p>
                      {isAdmin && item.preco_unitario > 0 && (
                        <>
                          <span className="text-faint text-xs">·</span>
                          <p className="text-xs text-secondary tabular-nums">
                            R$ {formatBRL(item.preco_unitario)}/un · <span className="font-semibold text-primary">R$ {formatBRL(subtotal)}</span>
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Ação rápida */}
                  <div className="flex items-center gap-2 shrink-0">
                    {expanded ? (
                      <button
                        onClick={() => marcarRecebido(item.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-subtle text-secondary hover:bg-input hover:text-ink-soft transition-colors"
                      >
                        <CheckCircle size={12} />
                        Recebido conforme
                      </button>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-success-tint text-success ring-1 ring-success/30">
                          <CheckCircle size={12} />
                          Recebido
                        </span>
                        <button
                          onClick={() => marcarDivergencia(item.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-subtle text-secondary hover:bg-danger-tint hover:text-danger hover:border-danger/40 transition-colors"
                        >
                          <AlertTriangle size={12} />
                          Divergência
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Campos expandidos — só aparece quando há divergência */}
                {expanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-danger/20 pt-3">

                    {/* Sub-status: Diferença ou Ausente */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => marcarDivergencia(item.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          item.status_item === 'DIFERENCA'
                            ? 'bg-danger-tint text-danger ring-1 ring-danger/30'
                            : 'bg-transparent border border-subtle text-secondary hover:bg-input hover:text-ink-soft'
                        }`}
                      >
                        Diferença de quantidade
                      </button>
                      <button
                        onClick={() => marcarAusente(item.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          item.status_item === 'AUSENTE'
                            ? 'bg-accent-tint text-accent-primary ring-1 ring-accent-primary/30'
                            : 'bg-transparent border border-subtle text-secondary hover:bg-input hover:text-ink-soft'
                        }`}
                      >
                        Não chegou (ausente)
                      </button>
                    </div>

                    {/* Quantidade recebida — oculta se AUSENTE */}
                    {item.status_item !== 'AUSENTE' && (
                      <div>
                        <label className="block text-xs font-medium uppercase tracking-wider text-secondary mb-1.5">
                          Qtd recebida
                          <span className="ml-1 text-danger normal-case font-normal tracking-normal">
                            ≠ enviado ({item.quantidade_enviada.toLocaleString('pt-BR')} un)
                          </span>
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.quantidade_recebida}
                          onChange={(e) => handleQtdChange(item.id, e.target.value)}
                          onFocus={(e) => e.target.select()}
                          className={CLS_INPUT}
                        />
                      </div>
                    )}

                    {/* Motivo */}
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-wider text-secondary mb-1.5">
                        Motivo <span className="text-danger">*</span>
                      </label>
                      <textarea
                        value={item.motivo_divergencia}
                        onChange={(e) => updateMotivo(item.id, e.target.value)}
                        placeholder="Descreva a divergência encontrada..."
                        rows={2}
                        className={`${CLS_INPUT} resize-none`}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-subtle px-6 py-4 space-y-3">
          {error && (
            <p className="text-sm text-danger bg-danger-tint rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg bg-transparent border border-subtle text-ink-soft hover:bg-input hover:text-primary text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleFinalizar}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent-primary hover:bg-accent-hover text-accent-ink text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
              {loading ? 'Salvando...' : 'Finalizar conferência'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
