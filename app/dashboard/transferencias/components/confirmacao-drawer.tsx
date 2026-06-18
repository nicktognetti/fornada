'use client'

import { useState } from 'react'
import { X, CheckCircle, Loader2 } from 'lucide-react'
import { confirmarRecebimentoAction } from '@/app/actions/transferencia'

type ItemInput = {
  id: string
  produto_nome: string
  quantidade_enviada: number
}

type ItemConferencia = {
  id: string
  produto_nome: string
  quantidade_enviada: number
  quantidade_recebida: number
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

export function ConfirmacaoDrawer({ transferenciaId, userId, itens, onClose, onSuccess }: Props) {
  const [conferencia, setConferencia] = useState<ItemConferencia[]>(() =>
    itens.map((i) => ({
      id: i.id,
      produto_nome: i.produto_nome,
      quantidade_enviada: i.quantidade_enviada,
      quantidade_recebida: i.quantidade_enviada,
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
          ? { ...i, status_item: status, quantidade_recebida: status === 'AUSENTE' ? 0 : i.quantidade_recebida }
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
      itens: conferencia.map((i) => ({
        id: i.id,
        quantidade_recebida: i.quantidade_recebida,
        status_item: i.status_item,
        motivo_divergencia: i.motivo_divergencia.trim() || undefined,
      })),
    })
    setLoading(false)

    if (result.error) { setError(result.error); return }
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="w-full max-w-[480px] bg-white h-full flex flex-col shadow-xl border-l border-[#e5ddd3]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#e5ddd3]">
          <div>
            <p className="text-base font-semibold text-[#1c1917]">Confirmar recebimento</p>
            <p className="text-xs text-[#78716c] mt-0.5">Confira cada item da transferência</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#78716c] hover:text-[#c2410c] hover:bg-[#fff7ed] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Itens */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {conferencia.map((item) => (
            <div
              key={item.id}
              className="bg-[#faf7f4] border border-[#e5ddd3] rounded-xl p-4 space-y-3"
            >
              <div>
                <p className="text-sm font-semibold text-[#1c1917]">{item.produto_nome}</p>
                <p className="text-xs text-[#78716c] mt-0.5">
                  Enviado: {item.quantidade_enviada.toLocaleString('pt-BR')} unid.
                </p>
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
                  const atCls = key === 'RECEBIDO'
                    ? 'bg-[#dcfce7] text-[#166534] ring-1 ring-[#166534]/30'
                    : key === 'DIFERENCA'
                    ? 'bg-[#fee2e2] text-[#991b1b] ring-1 ring-[#991b1b]/30'
                    : 'bg-[#fff7ed] text-[#9a3412] ring-1 ring-[#9a3412]/30'
                  return (
                    <button
                      key={key}
                      onClick={() => marcarStatus(item.id, key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        ativo
                          ? atCls
                          : 'bg-white border border-[#e5ddd3] text-[#78716c] hover:bg-[#faf7f4] hover:border-[#d5c9bd]'
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
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#78716c] mb-1.5">
                    Qtd recebida
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.quantidade_recebida}
                    onChange={(e) => updateItem(item.id, { quantidade_recebida: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white border border-[#e5ddd3] rounded-lg px-3.5 py-2 text-sm text-[#1c1917] focus:outline-none focus:ring-2 focus:ring-[#d97747]/30 focus:border-[#d97747]"
                  />
                </div>
              )}

              {/* Motivo da divergência */}
              {item.status_item === 'DIFERENCA' && (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#78716c] mb-1.5">
                    Motivo da divergência <span className="text-[#991b1b]">*</span>
                  </label>
                  <textarea
                    value={item.motivo_divergencia}
                    onChange={(e) => updateItem(item.id, { motivo_divergencia: e.target.value })}
                    placeholder="Descreva a divergência encontrada..."
                    rows={2}
                    className="w-full bg-white border border-[#e5ddd3] rounded-lg px-3.5 py-2 text-sm text-[#1c1917] placeholder:text-[#a8a29a] resize-none focus:outline-none focus:ring-2 focus:ring-[#d97747]/30 focus:border-[#d97747]"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-[#e5ddd3] px-6 py-4 space-y-3">
          {error && (
            <p className="text-sm text-[#991b1b] bg-[#fee2e2] rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg bg-white border border-[#e5ddd3] text-[#44403c] text-sm font-medium hover:bg-[#faf7f4] hover:border-[#d5c9bd] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleFinalizar}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#c2410c] hover:bg-[#d97747] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
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
