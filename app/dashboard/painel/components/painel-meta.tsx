'use client'

import { useState, useRef } from 'react'
import { Target, Pencil, Check, X, RotateCcw } from 'lucide-react'
import { formatBRL, parseDecimalBR } from '@/lib/format'
import { salvarMetaManual, limparMetaManual } from '@/app/actions/empresa'
import type { MetaFaturamento } from '@/app/actions/empresa'

interface Props {
  meta: MetaFaturamento
}

const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

function nomeMes(mesAno: string): string {
  const [ano, mes] = mesAno.split('-')
  return `${MESES[parseInt(mes, 10) - 1]} ${ano}`
}

export function PainelMeta({ meta: metaInicial }: Props) {
  const [meta, setMeta] = useState(metaInicial)
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState('')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() {
    setValor(meta.valorManual != null ? meta.valorManual.toFixed(2) : meta.valorCalculado.toFixed(2))
    setEditando(true)
    setTimeout(() => { inputRef.current?.select() }, 0)
  }

  async function handleSalvar() {
    const v = parseDecimalBR(valor)
    if (!v || v <= 0) { setErro('Valor inválido'); return }
    setSaving(true)
    const res = await salvarMetaManual(v)
    setSaving(false)
    if (res.error) { setErro(res.error); return }
    const novoPercentual = v > 0 ? Math.min(((meta.valorPortfolio ?? meta.faturamentoAtual) / v) * 100, 100) : 0
    setMeta((m) => ({ ...m, valorManual: v, valorEfetivo: v, percentual: novoPercentual }))
    setEditando(false)
    setErro(null)
  }

  async function handleLimpar() {
    setSaving(true)
    await limparMetaManual()
    setSaving(false)
    const portfolio = meta.valorPortfolio ?? meta.faturamentoAtual
    const novoPercentual = meta.valorCalculado > 0
      ? Math.min((portfolio / meta.valorCalculado) * 100, 100)
      : 0
    setMeta((m) => ({ ...m, valorManual: null, valorEfetivo: m.valorCalculado, percentual: novoPercentual }))
    setEditando(false)
    setErro(null)
  }

  const pct = Math.round(meta.percentual)
  const temManual = meta.valorManual != null

  // Cor da barra baseada no percentual
  const barColor =
    pct >= 100 ? 'var(--color-success)' :
    pct >= 70  ? 'var(--color-accent-primary)' :
    pct >= 40  ? 'var(--color-warning)' :
    'var(--color-danger)'

  return (
    <div className="card-surface px-5 py-4">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        {/* Título */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent-primary/10 flex items-center justify-center shrink-0">
            <Target size={14} className="text-accent-primary" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary">
              Meta do Mês
            </p>
            <p className="text-[11px] text-faint">{nomeMes(meta.mesAno)}</p>
          </div>
        </div>

        {/* Meta valor + edição */}
        <div className="flex items-center gap-2">
          {editando ? (
            <>
              <span className="text-secondary text-sm shrink-0">R$</span>
              <input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); void handleSalvar() }
                  if (e.key === 'Escape') { setEditando(false); setErro(null) }
                }}
                className="input-field text-sm py-1 px-2 w-32 text-right tabular-nums"
                disabled={saving}
                autoFocus
              />
              <button onClick={() => void handleSalvar()} disabled={saving}
                className="p-1.5 rounded-lg text-success hover:bg-success/10 transition-colors disabled:opacity-50">
                <Check size={13} />
              </button>
              <button onClick={() => { setEditando(false); setErro(null) }} disabled={saving}
                className="p-1.5 rounded-lg text-faint hover:text-secondary hover:bg-input transition-colors">
                <X size={13} />
              </button>
              {temManual && (
                <button onClick={() => void handleLimpar()} disabled={saving}
                  title="Voltar para meta calculada"
                  className="p-1.5 rounded-lg text-faint hover:text-amber-400 hover:bg-amber-500/10 transition-colors">
                  <RotateCcw size={12} />
                </button>
              )}
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="text-right">
                <p className="font-playfair font-bold text-lg tabular-nums text-primary leading-none">
                  R$ {formatBRL(meta.valorEfetivo)}
                </p>
                {temManual && (
                  <p className="text-[10px] text-faint">manual · sugerida: R$ {formatBRL(meta.valorCalculado)}</p>
                )}
              </div>
              <button
                onClick={startEdit}
                title="Definir meta manualmente"
                className="p-1.5 rounded-lg text-faint hover:text-accent-primary hover:bg-accent-primary/10 border border-transparent hover:border-accent-primary/20 transition-all"
              >
                <Pencil size={12} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Erro */}
      {erro && (
        <p className="text-danger text-xs mb-2">{erro}</p>
      )}

      {/* Barra de progresso */}
      <div className="space-y-1.5">
        <div className="h-2.5 bg-input rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: barColor }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px]">
          <span className="text-secondary tabular-nums">
            <span
              title="Soma dos preços cadastrados no portfólio. Não representa faturamento real (que depende de volume de vendas)."
              className="border-b border-dashed border-subtle cursor-help"
            >
              Portfólio R$ {formatBRL(meta.valorPortfolio ?? meta.faturamentoAtual)}
            </span>{' '}
            <span className="text-faint">/ meta R$ {formatBRL(meta.valorEfetivo)}</span>
          </span>
          <div className="flex items-center gap-2">
            <span style={{ color: barColor }} className="font-semibold tabular-nums">
              {pct}%
            </span>
            {meta.diasRestantes > 0 && (
              <span className="text-faint">
                · faltam {meta.diasRestantes} dia{meta.diasRestantes !== 1 ? 's' : ''}
              </span>
            )}
            {meta.diasRestantes === 0 && (
              <span className="text-faint">· último dia</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
