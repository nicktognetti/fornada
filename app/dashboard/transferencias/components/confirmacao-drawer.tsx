'use client'

import { useState } from 'react'
import { X, CheckCircle, Loader2 } from 'lucide-react'
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
  onClose: () => void
  onSuccess: () => void
}

const CLS_INPUT =
  'w-full bg-input border border-subtle rounded-lg px-3.5 py-2 text-sm text-primary placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent-primary/40 focus:border-accent-primary transition-colors'

export function ConfirmacaoDrawer({ transferenciaId, userId, itens, onClose, onSuccess }: Props) {
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

  function updateItem(
    id: string,
    patch: Partial<Pick<ItemConferencia, 'quantidade_recebida' | 'status_item' | 'motivo_divergencia'>>
  ) {
    setConferencia((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }

  function marcarStatus(id: string, status: ItemConferencia['status_item']) {
    setConferencia((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, status_item: status, quantidade_recebida: status === 'AUSENTE' ? '0' : i.quantidade_recebida }
          : i
      )
    )
  }

  async function handleFinalizar() {
    setError(null)
    const semMotivo = conferencia.find((i) => i.status_item === 'DIFERENCA' && !i.motivo_divergencia.trim())
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
            <p className="text-xs text-secondary mt-0.5">Confira cada item da transferência</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-secondary hover:text-accent-primary hover:bg-accent-tint transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Itens */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {conferencia.map((item) => {
            const subtotal = item.quantidade_enviada * item.preco_unitario
            return (
              <div
                key={item.id}
                className="bg-input border border-subtle rounded-xl p-4 space-y-3"
              >
                <div>
                  <p className="text-sm font-semibold text-primary">{item.produto_nome}</p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <p className="text-xs text-secondary">
                      Enviado: {item.quantidade_enviada.toLocaleString('pt-BR')} unid.
                    </p>
                    {item.preco_unitario > 0 && (
                      <>
                        <span className="text-faint text-xs">·</span>
                        <p className="text-xs text-secondary tabular-nums">
                          R$ {formatBRL(item.preco_unitario)}/un
                        </p>
                        <span className="text-faint text-xs">·</span>
                        <p className="text-xs font-semibold text-primary tabular-nums">
                          Subtotal: R$ {formatBRL(subtotal)}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Botões de status */}
                <div className="flex gap-2 flex-wrap">
                  {(
                    [
                      { key: 'RECEBIDO',  label: 'Recebido conforme' },
                      { key: 'DIFERENCA', label: 'Diferença' },
                      { key: 'AUSENTE',   label: 'Ausente' },
                    ] as const
                  ).map(({ key, label }) => {
                    const ativo = item.status_item === key
                    const atCls =
                      key === 'RECEBIDO'  ? 'bg-success-tint text-success ring-1 ring-success/30' :
                      key === 'DIFERENCA' ? 'bg-danger-tint text-danger ring-1 ring-danger/30' :
                                           'bg-accent-tint text-accent-primary ring-1 ring-accent-primary/30'
                    return (
                      <button
                        key={key}
                        onClick={() => marcarStatus(item.id, key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          ativo ? atCls : 'bg-transparent border border-subtle text-secondary hover:bg-input hover:text-ink-soft'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>

                {/* Quantidade recebida */}
                {item.status_item !== 'AUSENTE' && (
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wider text-secondary mb-1.5">
                      Qtd recebida
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.quantidade_recebida}
                      onChange={(e) => updateItem(item.id, { quantidade_recebida: e.target.value })}
                      className={CLS_INPUT}
                    />
                  </div>
                )}

                {/* Motivo da divergência */}
                {item.status_item === 'DIFERENCA' && (
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wider text-secondary mb-1.5">
                      Motivo da divergência <span className="text-danger">*</span>
                    </label>
                    <textarea
                      value={item.motivo_divergencia}
                      onChange={(e) => updateItem(item.id, { motivo_divergencia: e.target.value })}
                      placeholder="Descreva a divergência encontrada..."
                      rows={2}
                      className={`${CLS_INPUT} resize-none`}
                    />
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
