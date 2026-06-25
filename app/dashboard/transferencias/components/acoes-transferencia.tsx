'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PackageCheck, XCircle, Trash2, Loader2 } from 'lucide-react'
import { cancelarTransferenciaAction, excluirTransferenciaAction } from '@/app/actions/transferencia'
import { ConfirmacaoDrawer } from './confirmacao-drawer'

type ItemAcao = {
  id: string
  produto_nome: string
  quantidade_enviada: number
  preco_unitario: number
}

interface Props {
  transferenciaId: string
  userId: string
  podeConferir: boolean
  podeCancelar: boolean
  podeExcluir: boolean
  itens: ItemAcao[]
  isAdmin?: boolean
}

function ConfirmModal({
  titulo, descricao, labelConfirmar, danger,
  loading, onClose, onConfirm,
}: {
  titulo: string; descricao: string; labelConfirmar: string; danger?: boolean
  loading: boolean; onClose: () => void; onConfirm: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm bg-surface border border-subtle rounded-xl shadow-2xl shadow-black/40 p-6 space-y-4">
        <p className="text-base font-semibold text-primary">{titulo}</p>
        <p className="text-sm text-secondary">{descricao}</p>
        <div className="flex gap-3 justify-end pt-1">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg border border-subtle text-ink-soft hover:bg-input text-sm font-medium transition-colors"
          >
            Voltar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm ${
              danger
                ? 'bg-danger hover:bg-danger/90 text-white'
                : 'bg-accent-primary hover:bg-accent-hover text-accent-ink'
            }`}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {labelConfirmar}
          </button>
        </div>
      </div>
    </div>
  )
}

export function AcoesTransferencia({
  transferenciaId, userId,
  podeConferir, podeCancelar, podeExcluir,
  itens, isAdmin = false,
}: Props) {
  const router = useRouter()

  const [drawerOpen,    setDrawerOpen]    = useState(false)
  const [cancelModal,   setCancelModal]   = useState(false)
  const [excluirModal,  setExcluirModal]  = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error,         setError]         = useState<string | null>(null)

  async function handleCancelar() {
    setActionLoading(true)
    setError(null)
    const result = await cancelarTransferenciaAction(transferenciaId)
    setActionLoading(false)
    if (result.error) { setError(result.error); return }
    setCancelModal(false)
    router.refresh()
  }

  async function handleExcluir() {
    setActionLoading(true)
    setError(null)
    const result = await excluirTransferenciaAction(transferenciaId)
    setActionLoading(false)
    if (result.error) { setError(result.error); return }
    router.push('/dashboard/transferencias')
  }

  // Nada a mostrar — não renderiza o bloco de ações
  if (!podeConferir && !podeCancelar && !podeExcluir) return null

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {error && (
          <p className="text-sm text-danger w-full">{error}</p>
        )}
        {podeExcluir && (
          <button
            onClick={() => { setError(null); setExcluirModal(true) }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-danger/40 text-danger hover:bg-danger-tint text-sm font-medium transition-colors"
          >
            <Trash2 size={14} />
            Excluir
          </button>
        )}
        {podeCancelar && (
          <button
            onClick={() => { setError(null); setCancelModal(true) }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-subtle text-ink-soft hover:bg-input hover:text-primary text-sm font-medium transition-colors"
          >
            <XCircle size={14} />
            Cancelar
          </button>
        )}
        {podeConferir && (
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent-primary hover:bg-accent-hover text-accent-ink text-sm font-semibold shadow-sm transition-colors"
          >
            <PackageCheck size={15} />
            Confirmar recebimento
          </button>
        )}
      </div>

      {drawerOpen && (
        <ConfirmacaoDrawer
          transferenciaId={transferenciaId}
          userId={userId}
          itens={itens}
          isAdmin={isAdmin}
          onClose={() => setDrawerOpen(false)}
          onSuccess={() => { setDrawerOpen(false); router.refresh() }}
        />
      )}

      {cancelModal && (
        <ConfirmModal
          titulo="Cancelar transferência"
          descricao="Tem certeza que deseja cancelar esta transferência? Esta ação não pode ser desfeita."
          labelConfirmar="Sim, cancelar"
          loading={actionLoading}
          onClose={() => setCancelModal(false)}
          onConfirm={handleCancelar}
        />
      )}

      {excluirModal && (
        <ConfirmModal
          titulo="Excluir transferência"
          descricao="Tem certeza? Todos os itens serão removidos permanentemente."
          labelConfirmar="Excluir"
          danger
          loading={actionLoading}
          onClose={() => setExcluirModal(false)}
          onConfirm={handleExcluir}
        />
      )}
    </>
  )
}
