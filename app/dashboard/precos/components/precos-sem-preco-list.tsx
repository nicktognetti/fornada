'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tag, Sparkles, Check, Loader2 } from 'lucide-react'
import { formatBRL, formatCustoGrande, parseDecimalBR } from '@/lib/format'
import { savePrecoVendaLote, type ProdutoFinanceiro } from '@/app/actions/painel'
import { usePermission } from '@/app/context/permissions-context'
import { DefinirPrecoModal } from './definir-preco-modal'

/**
 * Seção "Sem preço definido" da tela de Preços: define preço direto aqui
 * (modal por produto) e um atalho de margem em lote — sem ir pro Painel.
 */
export function PrecosSemPrecoList({ produtos }: { produtos: ProdutoFinanceiro[] }) {
  const router = useRouter()
  const { canWrite } = usePermission('painel')
  const [alvo, setAlvo] = useState<ProdutoFinanceiro | null>(null)
  const [margem, setMargem] = useState('40')
  const [aplicando, setAplicando] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  async function aplicarLote() {
    const m = parseDecimalBR(margem)
    if (!(m > 0) || m >= 100) { setToast('Informe uma margem entre 1 e 99%'); return }
    const items = produtos
      .filter((p) => p.custo_total > 0)
      .map((p) => ({ id: p.produto_id, preco: p.custo_total / (1 - m / 100) }))
    if (items.length === 0) return
    setAplicando(true)
    const res = await savePrecoVendaLote(items)
    setAplicando(false)
    if (res.error) { setToast(res.error); return }
    const { salvos = 0 } = res.data ?? {}
    setToast(`${salvos} preço${salvos !== 1 ? 's' : ''} definido${salvos !== 1 ? 's' : ''} com ${m}% de margem`)
    router.refresh()
  }

  return (
    <>
      {/* Atalho: margem em lote */}
      {canWrite && produtos.length > 1 && (
        <div className="rounded-xl border border-accent-primary/20 bg-accent-primary/5 px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-secondary">
            <Sparkles size={14} className="text-accent-primary" />
            Definir todos de uma vez com margem
          </div>
          <div className="flex items-center gap-2">
            <input type="text" inputMode="decimal" value={margem} onChange={(e) => setMargem(e.target.value)}
              className="input-field text-sm py-1.5 px-3 w-20 text-right tabular-nums" />
            <span className="text-sm text-secondary">%</span>
          </div>
          <button onClick={aplicarLote} disabled={aplicando}
            className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50 ml-auto">
            {aplicando ? <><Loader2 size={14} className="animate-spin" /> Aplicando…</> : `Aplicar a todos (${produtos.length})`}
          </button>
        </div>
      )}

      {toast && (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm bg-success/10 border border-success/20 text-success">
          <Check size={13} /> {toast}
        </div>
      )}

      <div className="space-y-2">
        {produtos.map((p) => (
          <div key={p.produto_id} className="card-surface px-5 py-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-playfair text-primary text-[17px] font-semibold leading-tight truncate">{p.produto_nome}</p>
              <p className="text-secondary text-xs mt-1">
                custo: {p.rendimento_unidade ? formatCustoGrande(p.custo_total, p.rendimento_unidade) : `R$ ${formatBRL(p.custo_total)}`} — sem preço de venda
              </p>
            </div>
            {canWrite ? (
              <button onClick={() => setAlvo(p)}
                className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-accent-primary/25 text-accent-primary hover:bg-accent-primary/10 transition-colors">
                <Tag size={13} /> Definir preço
              </button>
            ) : (
              <span className="shrink-0 text-[11px] text-faint">sem permissão</span>
            )}
          </div>
        ))}
      </div>

      {alvo && (
        <DefinirPrecoModal
          produtoId={alvo.produto_id}
          nome={alvo.produto_nome}
          custoBase={alvo.custo_total}
          rendimentoUnidade={alvo.rendimento_unidade}
          onClose={() => setAlvo(null)}
        />
      )}
    </>
  )
}
