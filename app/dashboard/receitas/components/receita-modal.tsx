'use client'

import { useActionState, useEffect, useState } from 'react'
import { X, ChevronDown, Pencil, Clock, ListOrdered, Plus, Trash2, ChevronUp, Lightbulb } from 'lucide-react'
import { createReceita, updateReceita } from '../actions'
import { SectionLabel } from '@/app/components/ui/section-label'
import { UnidadeMedidaSelector } from '@/app/components/ui/unidade-medida-selector'
import type { ActionResult, Receita } from '../types'

interface Props {
  receita: Receita | null
  onClose: () => void
}

const TIPOS = [
  { value: 'final', label: 'Final — produto de venda' },
  { value: 'base', label: 'Base — sub-receita / preparação' },
  { value: 'massa', label: 'Massa' },
  { value: 'recheio', label: 'Recheio' },
  { value: 'cobertura', label: 'Cobertura' },
  { value: 'calda', label: 'Calda' },
]

const UNIDADES_RECEITA = [
  { value: 'g',  label: 'g',  nome: 'grama' },
  { value: 'kg', label: 'kg', nome: 'quilograma' },
  { value: 'ml', label: 'ml', nome: 'mililitro' },
  { value: 'l',  label: 'l',  nome: 'litro' },
  { value: 'un', label: 'un', nome: 'unidade' },
]

const DIFICULDADES = [
  { value: '', label: 'Não informar' },
  { value: 'facil', label: 'Fácil' },
  { value: 'media', label: 'Média' },
  { value: 'dificil', label: 'Difícil' },
]

export function ReceitaModal({ receita, onClose }: Props) {
  const isEdit = !!receita

  const [createState, createAction, createPending] = useActionState<ActionResult | undefined, FormData>(createReceita, undefined)
  const [editState, editAction, editPending] = useActionState<ActionResult | undefined, FormData>(updateReceita, undefined)

  const state = isEdit ? editState : createState
  const action = isEdit ? editAction : createAction
  const pending = isEdit ? editPending : createPending

  // Passos do modo de preparo — editados como lista e enviados como JSON.
  const [passos, setPassos] = useState<string[]>(receita?.passos?.length ? receita.passos : [''])

  function setPasso(i: number, v: string) {
    setPassos((p) => p.map((s, idx) => (idx === i ? v : s)))
  }
  function addPasso() {
    setPassos((p) => [...p, ''])
  }
  function removePasso(i: number) {
    setPassos((p) => (p.length === 1 ? [''] : p.filter((_, idx) => idx !== i)))
  }
  function moverPasso(i: number, dir: -1 | 1) {
    setPassos((p) => {
      const j = i + dir
      if (j < 0 || j >= p.length) return p
      const next = [...p]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  const passosJson = JSON.stringify(passos.map((s) => s.trim()).filter(Boolean))

  useEffect(() => {
    if (createState?.success || editState?.success) onClose()
  }, [createState?.success, editState?.success, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-2xl border border-accent-primary/12 shadow-[0_8px_40px_rgba(0,0,0,0.12)] w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-accent-primary/10 shrink-0">
          <div>
            <h2 className="font-playfair text-primary text-[22px] font-bold leading-tight">
              {isEdit ? receita.nome : 'Nova Receita'}
            </h2>
            {isEdit && <p className="text-secondary text-xs mt-0.5">editar ficha técnica</p>}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:text-accent-primary hover:bg-accent-primary/10 transition-all" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          <form action={action} className="space-y-6">
            {isEdit && <input type="hidden" name="id" value={receita.id} />}
            <input type="hidden" name="passos" value={passosJson} />

            {/* ── Dados da receita ── */}
            <div className="space-y-5">
              <SectionLabel icon={Pencil}>Dados da receita</SectionLabel>

              <div>
                <label className="field-label">Nome</label>
                <input
                  type="text" name="nome" required
                  defaultValue={receita?.nome}
                  placeholder="Ex: Pão de mel, Croissant, Ganache…"
                  className="input-field"
                />
              </div>

              <div>
                <label className="field-label">Tipo</label>
                <div className="relative">
                  <select name="tipo" defaultValue={receita?.tipo ?? 'final'} className="input-field appearance-none pr-10">
                    {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-secondary/50 pointer-events-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Rendimento</label>
                  <input
                    type="text" inputMode="decimal" name="rendimento" required
                    defaultValue={receita?.rendimento?.toString().replace('.', ',')}
                    placeholder="Ex: 1000"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="field-label">Unidade</label>
                  <UnidadeMedidaSelector
                    name="rendimento_unidade"
                    options={UNIDADES_RECEITA}
                    defaultValue={receita?.rendimento_unidade ?? 'g'}
                  />
                </div>
              </div>
            </div>

            {/* ── Tempos e forno ── */}
            <div className="space-y-4 pt-1">
              <SectionLabel icon={Clock}>Tempos e forno</SectionLabel>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="field-label">Preparo (min)</label>
                  <input
                    type="text" inputMode="numeric" name="tempo_preparo_min"
                    defaultValue={receita?.tempo_preparo_min ?? ''}
                    placeholder="25" className="input-field"
                  />
                </div>
                <div>
                  <label className="field-label">Forno (°C)</label>
                  <input
                    type="text" inputMode="numeric" name="temperatura_forno"
                    defaultValue={receita?.temperatura_forno ?? ''}
                    placeholder="180" className="input-field"
                  />
                </div>
                <div>
                  <label className="field-label">Forno (min)</label>
                  <input
                    type="text" inputMode="numeric" name="tempo_forno_min"
                    defaultValue={receita?.tempo_forno_min ?? ''}
                    placeholder="40" className="input-field"
                  />
                </div>
                <div>
                  <label className="field-label">Dificuldade</label>
                  <div className="relative">
                    <select name="dificuldade" defaultValue={receita?.dificuldade ?? ''} className="input-field appearance-none pr-8">
                      {DIFICULDADES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary/50 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Modo de preparo (passos) ── */}
            <div className="space-y-3 pt-1">
              <SectionLabel icon={ListOrdered}>Modo de preparo</SectionLabel>

              <div className="space-y-2">
                {passos.map((passo, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="shrink-0 w-7 h-7 mt-1 rounded-full bg-accent-primary/15 text-accent-primary flex items-center justify-center text-sm font-semibold tabular-nums">
                      {i + 1}
                    </div>
                    <textarea
                      value={passo}
                      onChange={(e) => setPasso(i, e.target.value)}
                      placeholder={`Passo ${i + 1} — o que fazer…`}
                      rows={2}
                      className="input-field resize-none flex-1"
                    />
                    <div className="flex flex-col gap-1 shrink-0 mt-0.5">
                      <button type="button" onClick={() => moverPasso(i, -1)} disabled={i === 0}
                        className="w-7 h-6 rounded-md flex items-center justify-center text-secondary hover:text-accent-primary hover:bg-accent-primary/10 disabled:opacity-30 disabled:hover:bg-transparent transition-all" aria-label="Subir passo">
                        <ChevronUp size={14} />
                      </button>
                      <button type="button" onClick={() => removePasso(i)}
                        className="w-7 h-6 rounded-md flex items-center justify-center text-secondary hover:text-red-400 hover:bg-red-500/10 transition-all" aria-label="Remover passo">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button type="button" onClick={addPasso} className="btn-ghost text-xs px-3 py-2 min-h-[36px]">
                <Plus size={13} />
                Adicionar passo
              </button>
            </div>

            {/* ── Dica / segredo ── */}
            <div className="space-y-3 pt-1">
              <SectionLabel icon={Lightbulb}>Dica / segredo da casa <span className="normal-case font-normal text-secondary/70">(opcional)</span></SectionLabel>
              <textarea
                name="observacao"
                defaultValue={receita?.observacao ?? ''}
                placeholder="Ex: não abra o forno nos primeiros 25 min ou o bolo sola."
                rows={2}
                className="input-field resize-none"
              />
            </div>

            {state?.error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-400 text-sm">
                {state.error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancelar</button>
              <button type="submit" disabled={pending} className="btn-primary flex-1">
                {pending ? 'Salvando…' : isEdit ? 'Salvar Alterações' : 'Criar Receita'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
