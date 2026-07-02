'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { X, Calculator, Check, Loader2 } from 'lucide-react'
import { savePrecoVenda } from '@/app/actions/painel'
import { parseDecimalBR, formatBRL, valorPorGrande, unidadeGrande, fatorGrande } from '@/lib/format'

interface Props {
  produtoId: string
  nome: string
  /** Custo por unidade-base (por grama/ml/un). */
  custoBase: number
  /** Unidade de rendimento (g/kg/ml/l/un) — null p/ revenda (por unidade). */
  rendimentoUnidade: string | null
  /** Preço atual por unidade-base (0 se sem preço). */
  precoAtualBase?: number
  onClose: () => void
  onSaved?: () => void
}

type Modo = 'preco' | 'margem'

/**
 * Modal amigável para definir o preço de venda de um produto — sem sair da tela.
 * Dois modos: digitar o preço (por kg/L/un) ou informar a margem desejada.
 * Mostra margem/markup resultantes ao vivo. Salva por unidade-base (÷fator).
 */
export function DefinirPrecoModal({ produtoId, nome, custoBase, rendimentoUnidade, precoAtualBase = 0, onClose, onSaved }: Props) {
  const router = useRouter()
  const fator = fatorGrande(rendimentoUnidade)
  const un = unidadeGrande(rendimentoUnidade)
  const custoGrande = valorPorGrande(custoBase, rendimentoUnidade)

  const [modo, setModo] = useState<Modo>('preco')
  const [precoInput, setPrecoInput] = useState(precoAtualBase > 0 ? formatBRL(valorPorGrande(precoAtualBase, rendimentoUnidade)) : '')
  const [margemInput, setMargemInput] = useState('40')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Preço final por unidade grande (kg/L/un), conforme o modo.
  const precoGrande = useMemo(() => {
    if (modo === 'preco') {
      const v = parseDecimalBR(precoInput)
      return v > 0 ? v : null
    }
    const m = parseDecimalBR(margemInput)
    if (!(m > 0) || m >= 100 || custoGrande <= 0) return null
    return custoGrande / (1 - m / 100)
  }, [modo, precoInput, margemInput, custoGrande])

  const margemResultante = precoGrande && precoGrande > 0 ? ((precoGrande - custoGrande) / precoGrande) * 100 : null
  const markupResultante = precoGrande && custoGrande > 0 ? ((precoGrande - custoGrande) / custoGrande) * 100 : null

  async function salvar() {
    if (!precoGrande || precoGrande <= 0) { setErro('Informe um preço ou margem válidos'); return }
    setErro(null)
    setSaving(true)
    const precoBase = precoGrande / fator
    const res = await savePrecoVenda(produtoId, precoBase)
    setSaving(false)
    if (res.error) { setErro(res.error); return }
    onSaved?.()
    router.refresh()
    onClose()
  }

  const INPUT = 'input-field text-sm py-2.5 w-full'
  const margemColor = margemResultante == null ? 'text-secondary'
    : margemResultante < 0 ? 'text-danger' : margemResultante < 20 ? 'text-amber-400' : 'text-success'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose() }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-surface border border-subtle rounded-2xl shadow-2xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Calculator size={16} className="text-accent-primary shrink-0" />
              <h2 className="text-base font-semibold text-primary">Definir preço</h2>
            </div>
            <p className="text-secondary text-sm mt-1 truncate">{nome}</p>
          </div>
          <button onClick={onClose} disabled={saving} className="text-faint hover:text-secondary p-1 shrink-0"><X size={16} /></button>
        </div>

        {/* Custo de referência */}
        <div className="rounded-xl bg-canvas border border-subtle px-4 py-3 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-secondary">Custo de produção</span>
          <span className="text-sm font-semibold text-ink-soft tabular-nums">
            {custoGrande > 0 ? `R$ ${formatBRL(custoGrande)}/${un}` : '—'}
          </span>
        </div>

        {/* Modo */}
        <div className="flex bg-input p-1 rounded-xl gap-1">
          {([['preco', 'Digitar preço'], ['margem', 'Por margem %']] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => { setModo(key); setErro(null) }}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                modo === key ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Entrada */}
        {modo === 'preco' ? (
          <div className="space-y-1">
            <label className="field-label">Preço de venda (R$/{un})</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary text-sm">R$</span>
              <input type="text" inputMode="decimal" value={precoInput} autoFocus
                onChange={(e) => { setPrecoInput(e.target.value); setErro(null) }}
                placeholder="0,00" className={`${INPUT} pl-9 text-right tabular-nums`} disabled={saving} />
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <label className="field-label">Margem desejada (%)</label>
            <div className="relative">
              <input type="text" inputMode="decimal" value={margemInput} autoFocus
                onChange={(e) => { setMargemInput(e.target.value); setErro(null) }}
                placeholder="40" className={`${INPUT} pr-8 text-right tabular-nums`} disabled={saving} />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-secondary text-sm">%</span>
            </div>
            <p className="text-[11px] text-faint">Preço = custo ÷ (1 − margem%). Ex.: 40% → o custo é 60% do preço.</p>
          </div>
        )}

        {/* Resultado ao vivo */}
        <div className="rounded-xl border border-accent-primary/20 bg-accent-primary/6 px-4 py-3 space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs uppercase tracking-wider text-secondary">Preço de venda</span>
            <span className="font-playfair text-primary text-2xl font-bold tabular-nums">
              {precoGrande ? `R$ ${formatBRL(precoGrande)}` : '—'}
              {precoGrande && <span className="text-xs font-normal text-secondary">/{un}</span>}
            </span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-accent-primary/10 text-sm">
            <span className="text-secondary">Margem: <span className={`font-semibold tabular-nums ${margemColor}`}>{margemResultante != null ? `${margemResultante.toFixed(1)}%` : '—'}</span></span>
            <span className="text-secondary">Markup: <span className="font-semibold text-ink-soft tabular-nums">{markupResultante != null ? `${markupResultante.toFixed(1)}%` : '—'}</span></span>
          </div>
        </div>

        {erro && <p className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{erro}</p>}

        <div className="flex justify-end gap-3">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-xl text-sm text-secondary hover:text-primary hover:bg-input transition-colors">Cancelar</button>
          <button onClick={salvar} disabled={saving || !precoGrande} className="btn-primary px-5 py-2 disabled:opacity-50">
            {saving ? <><Loader2 size={15} className="animate-spin" /> Salvando…</> : <><Check size={15} /> Salvar preço</>}
          </button>
        </div>
      </div>
    </div>
  )
}
