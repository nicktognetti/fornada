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

const CLS_INPUT =
  'w-full bg-[#2a2a2e] border border-[#333336] rounded-lg px-3.5 py-2 text-sm text-[#f5f5f0] placeholder:text-[#666666] focus:outline-none focus:ring-2 focus:ring-[#d98d5f]/40 focus:border-[#d98d5f] transition-colors'

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
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="w-full max-w-[480px] bg-[#222226] border-l border-[#333336] h-full flex flex-col shadow-2xl shadow-black/40">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#333336]">
          <div>
            <p className="text-base font-semibold text-[#f5f5f0]">Confirmar recebimento</p>
            <p className="text-xs text-[#888888] mt-0.5">Confira cada item da transferência</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#888888] hover:text-[#d98d5f] hover:bg-[#2a2a1e] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Itens */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {conferencia.map((item) => (
            <div
              key={item.id}
              className="bg-[#2a2a2e] border border-[#333336] rounded-xl p-4 space-y-3"
            >
              <div>
                <p className="text-sm font-semibold text-[#f5f5f0]">{item.produto_nome}</p>
                <p className="text-xs text-[#888888] mt-0.5">
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
                  const atCls =
                    key === 'RECEBIDO'  ? 'bg-[#1e2a1e] text-[#5f9a5f] ring-1 ring-[#5f9a5f]/30' :
                    key === 'DIFERENCA' ? 'bg-[#2a1e1e] text-[#c74a4a] ring-1 ring-[#c74a4a]/30' :
                                         'bg-[#2a2a1e] text-[#d9a05f] ring-1 ring-[#d9a05f]/30'
                  return (
                    <button
                      key={key}
                      onClick={() => marcarStatus(item.id, key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        ativo ? atCls : 'bg-transparent border border-[#333336] text-[#888888] hover:bg-[#2a2a2e] hover:text-[#d4d4d0]'
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
                  <label className="block text-xs font-medium uppercase tracking-wider text-[#888888] mb-1.5">
                    Qtd recebida
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.quantidade_recebida}
                    onChange={(e) => updateItem(item.id, { quantidade_recebida: parseFloat(e.target.value) || 0 })}
                    className={CLS_INPUT}
                  />
                </div>
              )}

              {/* Motivo da divergência */}
              {item.status_item === 'DIFERENCA' && (
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-[#888888] mb-1.5">
                    Motivo da divergência <span className="text-[#c74a4a]">*</span>
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
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-[#333336] px-6 py-4 space-y-3">
          {error && (
            <p className="text-sm text-[#c74a4a] bg-[#2a1e1e] rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg bg-transparent border border-[#333336] text-[#d4d4d0] hover:bg-[#2a2a2e] hover:text-white text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleFinalizar}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#d98d5f] hover:bg-[#e8a57a] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
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
