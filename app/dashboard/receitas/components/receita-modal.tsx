'use client'

import { useActionState, useEffect } from 'react'
import { X, ChevronDown, Pencil } from 'lucide-react'
import { createReceita, updateReceita } from '../actions'
import { SectionLabel } from '@/app/components/ui/section-label'
import type { ActionResult, Receita } from '../types'

interface Props {
  receita: Receita | null
  onClose: () => void
}

const TIPOS = [
  { value: 'final', label: 'Final — produto de venda' },
  { value: 'base', label: 'Base — sub-receita / preparação' },
]

const UNIDADES = [
  { value: 'g', label: 'g — grama' },
  { value: 'kg', label: 'kg — quilograma' },
  { value: 'ml', label: 'ml — mililitro' },
  { value: 'l', label: 'l — litro' },
  { value: 'un', label: 'un — unidade' },
]

export function ReceitaModal({ receita, onClose }: Props) {
  const isEdit = !!receita

  const [createState, createAction, createPending] = useActionState<ActionResult | undefined, FormData>(
    createReceita, undefined
  )
  const [editState, editAction, editPending] = useActionState<ActionResult | undefined, FormData>(
    updateReceita, undefined
  )

  const state = isEdit ? editState : createState
  const action = isEdit ? editAction : createAction
  const pending = isEdit ? editPending : createPending

  useEffect(() => {
    if (createState?.success || editState?.success) onClose()
  }, [createState?.success, editState?.success, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-[#1a1a22] rounded-2xl border border-white/10 shadow-[0_24px_64px_rgba(0,0,0,0.6)] w-full max-w-md max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/[0.07] shrink-0">
          <div>
            <h2 className="font-playfair text-creme text-[22px] font-bold leading-tight">
              {isEdit ? receita.nome : 'Nova Receita'}
            </h2>
            {isEdit && <p className="text-demerara text-xs mt-0.5">editar ficha técnica</p>}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-demerara/50 hover:text-creme hover:bg-white/8 transition-all" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          <form action={action} className="space-y-5">
            {isEdit && <input type="hidden" name="id" value={receita.id} />}

            <SectionLabel icon={Pencil}>Dados da receita</SectionLabel>

            {/* Nome */}
            <div>
              <label className="field-label">Nome</label>
              <input
                type="text"
                name="nome"
                required
                defaultValue={receita?.nome}
                placeholder="Ex: Pão de mel, Croissant, Ganache…"
                className="input-field"
              />
            </div>

            {/* Tipo */}
            <div>
              <label className="field-label">Tipo</label>
              <div className="relative">
                <select
                  name="tipo"
                  defaultValue={receita?.tipo ?? 'final'}
                  className="input-field appearance-none pr-10"
                >
                  {TIPOS.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-demerara/50 pointer-events-none" />
              </div>
            </div>

            {/* Rendimento */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Rendimento</label>
                <input
                  type="text"
                  inputMode="decimal"
                  name="rendimento"
                  required
                  defaultValue={receita?.rendimento?.toString().replace('.', ',')}
                  placeholder="Ex: 1000"
                  className="input-field"
                />
              </div>
              <div>
                <label className="field-label">Unidade</label>
                <div className="relative">
                  <select
                    name="rendimento_unidade"
                    defaultValue={receita?.rendimento_unidade ?? 'g'}
                    className="input-field appearance-none pr-8"
                  >
                    {UNIDADES.map(u => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-demerara/50 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Observação */}
            <div>
              <label className="field-label">Observação <span className="normal-case font-normal">(opcional)</span></label>
              <textarea
                name="observacao"
                defaultValue={receita?.observacao ?? ''}
                placeholder="Modo de preparo, dicas, variações…"
                rows={3}
                className="input-field resize-none"
              />
            </div>

            {/* Erro */}
            {state?.error && (
              <div className="rounded-xl border border-red-400/20 bg-red-400/8 px-4 py-3 text-red-400 text-sm">
                {state.error}
              </div>
            )}

            {/* Botões */}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="btn-ghost flex-1">
                Cancelar
              </button>
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
