'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Check, X, ChevronDown, ChevronUp, Receipt } from 'lucide-react'
import { formatBRL, parseDecimalBR } from '@/lib/format'
import { saveDespesaFixa, deleteDespesaFixa } from '@/app/actions/painel'
import { usePermission } from '@/app/context/permissions-context'
import type { DespesaFixa } from '@/app/actions/painel'

interface Props {
  despesas: DespesaFixa[]
  onDespesasChange: (despesas: DespesaFixa[]) => void
}

// ── Form inline ───────────────────────────────────────────────────────────────

function DespesaForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: DespesaFixa
  onSave: (d: DespesaFixa) => void
  onCancel: () => void
}) {
  const [descricao, setDescricao] = useState(initial?.descricao ?? '')
  const [valor, setValor] = useState(initial ? initial.valor.toFixed(2) : '')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSalvar() {
    const v = parseDecimalBR(valor)
    if (!descricao.trim()) { setErro('Descrição obrigatória'); return }
    if (Number.isNaN(v) || v <= 0) { setErro('Valor inválido'); return }
    setSaving(true)
    const res = await saveDespesaFixa(descricao.trim(), v, initial?.id)
    setSaving(false)
    if (res.error) { setErro(res.error); return }
    onSave({
      id: res.data?.id ?? initial?.id ?? '',
      empresa_id: initial?.empresa_id ?? '',
      descricao: descricao.trim(),
      valor: v,
      created_at: initial?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }

  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-canvas/50 border-b border-subtle">
      <input
        type="text"
        placeholder="Ex: Aluguel, Salários, Energia…"
        value={descricao}
        onChange={(e) => { setDescricao(e.target.value); setErro(null) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); void handleSalvar() }
          if (e.key === 'Escape') onCancel()
        }}
        className="input-field text-sm py-1.5 flex-1"
        disabled={saving}
        autoFocus
        maxLength={200}
      />
      <span className="text-secondary text-sm shrink-0">R$</span>
      <input
        type="text"
        inputMode="decimal"
        placeholder="0,00"
        value={valor}
        onChange={(e) => { setValor(e.target.value); setErro(null) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); void handleSalvar() }
          if (e.key === 'Escape') onCancel()
        }}
        className="input-field text-sm py-1.5 w-28 text-right tabular-nums"
        disabled={saving}
      />
      <button onClick={() => void handleSalvar()} disabled={saving}
        className="p-1.5 rounded-lg text-success hover:bg-success/10 transition-colors disabled:opacity-50 shrink-0">
        <Check size={14} />
      </button>
      <button onClick={onCancel} disabled={saving}
        className="p-1.5 rounded-lg text-faint hover:text-secondary hover:bg-input transition-colors shrink-0">
        <X size={14} />
      </button>
      {erro && <p className="text-danger text-xs shrink-0">{erro}</p>}
    </div>
  )
}

// ── PainelDespesas ────────────────────────────────────────────────────────────

export function PainelDespesas({ despesas, onDespesasChange }: Props) {
  const [open, setOpen] = useState(false)
  const [adicionando, setAdicionando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [deletandoId, setDeletandoId] = useState<string | null>(null)
  const { canWrite } = usePermission('painel')

  const total = despesas.reduce((s, d) => s + d.valor, 0)

  function handleAdd(d: DespesaFixa) {
    onDespesasChange([...despesas, d])
    setAdicionando(false)
  }

  function handleEdit(d: DespesaFixa) {
    onDespesasChange(despesas.map((x) => x.id === d.id ? d : x))
    setEditandoId(null)
  }

  async function handleDelete(id: string) {
    setDeletandoId(id)
    await deleteDespesaFixa(id)
    onDespesasChange(despesas.filter((d) => d.id !== id))
    setDeletandoId(null)
  }

  return (
    <section className="card-surface border border-subtle rounded-2xl overflow-hidden">
      {/* Header colapsável */}
      <button
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-canvas/30 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent-primary/10 flex items-center justify-center shrink-0">
            <Receipt size={14} className="text-accent-primary" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-primary leading-tight">Despesas Fixas Mensais</p>
            <p className="text-[11px] text-faint">
              {despesas.length > 0
                ? `${despesas.length} despesa${despesas.length !== 1 ? 's' : ''} · total R$ ${formatBRL(total)}`
                : 'Nenhuma despesa cadastrada'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <span className="text-[11px] tabular-nums font-semibold text-accent-primary">
              R$ {formatBRL(total)}
            </span>
          )}
          {open ? <ChevronUp size={14} className="text-faint" /> : <ChevronDown size={14} className="text-faint" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-subtle">
          {/* Formulário de nova despesa */}
          {adicionando && (
            <DespesaForm onSave={handleAdd} onCancel={() => setAdicionando(false)} />
          )}

          {/* Lista */}
          {despesas.length > 0 ? (
            <div className="divide-y divide-subtle">
              {despesas.map((d) =>
                editandoId === d.id ? (
                  <DespesaForm
                    key={d.id}
                    initial={d}
                    onSave={handleEdit}
                    onCancel={() => setEditandoId(null)}
                  />
                ) : (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-canvas/30 group transition-colors"
                  >
                    <span className="flex-1 text-sm text-primary truncate">{d.descricao}</span>
                    <span className="text-sm tabular-nums text-secondary shrink-0">
                      R$ {formatBRL(d.valor)}
                    </span>
                    {canWrite && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditandoId(d.id)}
                          className="p-1 rounded text-faint hover:text-accent-primary hover:bg-accent-primary/10 transition-colors"
                          title="Editar"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => void handleDelete(d.id)}
                          disabled={deletandoId === d.id}
                          className="p-1 rounded text-faint hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-40"
                          title="Remover"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          ) : (
            !adicionando && (
              <div className="px-5 py-8 text-center">
                <p className="text-faint text-sm">Nenhuma despesa fixa cadastrada ainda.</p>
                <p className="text-[11px] text-faint mt-1">
                  Cadastre aluguel, salários, energia e outros custos fixos mensais.
                </p>
              </div>
            )
          )}

          {/* Totalizador + botão adicionar */}
          <div className="px-5 py-3 border-t border-subtle flex items-center justify-between bg-canvas/20">
            {total > 0 ? (
              <p className="text-[11px] text-secondary">
                Total:{' '}
                <span className="font-semibold tabular-nums text-primary">R$ {formatBRL(total)}</span>
                <span className="text-faint ml-1">/ mês</span>
              </p>
            ) : (
              <p className="text-[11px] text-faint">Total: R$ 0,00 / mês</p>
            )}
            {canWrite && !adicionando && (
              <button
                onClick={() => setAdicionando(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-primary/10 border border-accent-primary/25 text-accent-primary hover:bg-accent-primary/20 transition-colors"
              >
                <Plus size={12} />
                Adicionar
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
