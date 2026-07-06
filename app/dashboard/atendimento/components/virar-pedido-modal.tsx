'use client'

import { useState } from 'react'
import { Loader2, ClipboardList } from 'lucide-react'
import { virarPedido, type EncomendaAnotada } from '@/app/actions/atendimento'

// Completa data/hora reais (o robô anota texto livre) e cria a encomenda
// OFICIAL no módulo de Encomendas. Compartilhado pelas abas Conversas e Pedidos.
export function VirarPedidoModal({
  anotada, onClose, onDone,
}: {
  anotada: EncomendaAnotada
  onClose: () => void
  onDone: () => void
}) {
  const hoje = new Date().toISOString().slice(0, 10)
  const [data, setData] = useState(anotada.canal === 'delivery' ? hoje : '')
  const [hora, setHora] = useState('')
  const [qtd, setQtd] = useState('1')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar() {
    if (!data || !hora) { setErro('Informe data e hora de entrega/retirada'); return }
    setSalvando(true)
    setErro(null)
    const res = await virarPedido(anotada.id, {
      data_entrega: data,
      hora_entrega: hora,
      quantidade: Number(qtd.replace(',', '.')) || 1,
    })
    setSalvando(false)
    if (res.error) { setErro(res.error); return }
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card-surface w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="font-playfair text-primary text-lg font-semibold">Virar pedido</h3>
          <p className="text-xs text-secondary mt-1">
            <span className="font-medium text-primary">{anotada.produto}</span>
            {anotada.quantidade && ` · ${anotada.quantidade}`}
            {anotada.data_texto && ` · cliente falou: "${anotada.data_texto}"`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">{anotada.canal === 'delivery' ? 'Data de entrega' : 'Data de retirada'}</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="field-label">Hora</label>
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="input-field" />
          </div>
        </div>
        <div>
          <label className="field-label">Quantidade</label>
          <input type="text" inputMode="decimal" value={qtd} onChange={(e) => setQtd(e.target.value)} className="input-field" />
          <p className="text-[11px] text-faint mt-1">O valor fica em aberto (encomenda sem valor) — ajuste depois em Encomendas.</p>
        </div>

        {erro && <p className="text-xs text-danger bg-danger-tint rounded-lg px-3 py-2">{erro}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-secondary hover:text-primary transition-colors">
            Cancelar
          </button>
          <button onClick={salvar} disabled={salvando} className="btn-primary disabled:opacity-50">
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <ClipboardList size={14} />}
            Criar encomenda
          </button>
        </div>
      </div>
    </div>
  )
}
