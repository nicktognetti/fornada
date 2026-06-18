'use client'

import { useActionState, useEffect, useState } from 'react'
import { X, ShoppingCart } from 'lucide-react'
import { addItem, updateItem, getInsumos, getReceitasParaSubReceita } from '../actions'
import { SectionLabel } from '@/app/components/ui/section-label'
import { normalizeSearch } from '@/lib/format'
import type { ActionResult, ReceitaItemComCusto, InsumoOpcao } from '../types'

interface SubReceitaOpcao {
  id: string
  nome: string
  rendimento_unidade: string
}

interface Props {
  receitaId: string
  item: ReceitaItemComCusto | null
  onClose: () => void
}

type TipoItem = 'insumo' | 'sub_receita'

export function ItemModal({ receitaId, item, onClose }: Props) {
  const isEdit = !!item

  const [addState, addAction, addPending] = useActionState<ActionResult | undefined, FormData>(addItem, undefined)
  const [editState, editAction, editPending] = useActionState<ActionResult | undefined, FormData>(updateItem, undefined)

  const state = isEdit ? editState : addState
  const action = isEdit ? editAction : addAction
  const pending = isEdit ? editPending : addPending

  const [tipo, setTipo] = useState<TipoItem>(item?.sub_receita_id ? 'sub_receita' : 'insumo')
  const [busca, setBusca] = useState('')
  const [selectedId, setSelectedId] = useState<string>(item?.insumo_id ?? item?.sub_receita_id ?? '')
  const [insumos, setInsumos] = useState<InsumoOpcao[]>([])
  const [subReceitas, setSubReceitas] = useState<SubReceitaOpcao[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getInsumos(), getReceitasParaSubReceita(receitaId)]).then(([ins, subs]) => {
      setInsumos(ins as InsumoOpcao[])
      setSubReceitas(subs as SubReceitaOpcao[])
      setLoading(false)
    })
  }, [receitaId])

  useEffect(() => {
    if (addState?.success || editState?.success) onClose()
  }, [addState?.success, editState?.success, onClose])

  function handleTipoChange(t: TipoItem) {
    setTipo(t)
    setBusca('')
    setSelectedId('')
  }

  const termNorm = normalizeSearch(busca)
  const opcoes = tipo === 'insumo'
    ? insumos.filter(i => !termNorm || normalizeSearch(i.nome).includes(termNorm) || normalizeSearch(i.categoria ?? '').includes(termNorm))
    : subReceitas.filter(s => !termNorm || normalizeSearch(s.nome).includes(termNorm))

  const selected = tipo === 'insumo'
    ? insumos.find(i => i.id === selectedId)
    : subReceitas.find(s => s.id === selectedId)

  const unidadeDisplay = selected
    ? ('unidade_uso' in selected ? selected.unidade_uso : selected.rendimento_unidade)
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-marrom-500/12 shadow-[0_8px_40px_rgba(0,0,0,0.12)] w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-marrom-500/10 shrink-0">
          <div>
            <h2 className="font-playfair text-madrugada-800 text-[22px] font-bold leading-tight">
              {isEdit ? 'Editar Item' : 'Adicionar Item'}
            </h2>
            {isEdit && <p className="text-demerara text-xs mt-0.5">{item.nome_display}</p>}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-demerara hover:text-marrom-500 hover:bg-marrom-500/10 transition-all" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          <form action={action} className="space-y-5">
            <input type="hidden" name="receita_id" value={receitaId} />
            {isEdit && <input type="hidden" name="id" value={item.id} />}
            <input type="hidden" name={tipo === 'insumo' ? 'insumo_id' : 'sub_receita_id'} value={selectedId} />

            {/* Tipo toggle */}
            <SectionLabel icon={ShoppingCart}>Tipo de item</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {(['insumo', 'sub_receita'] as TipoItem[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTipoChange(t)}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                    tipo === t
                      ? 'bg-marrom-500/15 border-marrom-500/30 text-marrom-500'
                      : 'bg-transparent border-marrom-500/15 text-demerara hover:text-madrugada-800 hover:border-marrom-500/25'
                  }`}
                >
                  {t === 'insumo' ? 'Insumo' : 'Sub-receita'}
                </button>
              ))}
            </div>

            {/* Busca */}
            <div>
              <label className="field-label">
                {tipo === 'insumo' ? 'Buscar insumo' : 'Buscar sub-receita'}
              </label>
              <input
                type="text"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder={tipo === 'insumo' ? 'Digite o nome ou categoria…' : 'Digite o nome da receita…'}
                className="input-field"
              />
            </div>

            {/* Lista de opções */}
            <div className="max-h-52 overflow-y-auto rounded-xl border border-marrom-500/12 bg-creme-50 divide-y divide-marrom-500/8">
              {loading ? (
                <p className="text-demerara text-sm px-4 py-3">Carregando…</p>
              ) : opcoes.length === 0 ? (
                <p className="text-demerara/60 text-sm px-4 py-3">Nenhum resultado</p>
              ) : (
                opcoes.slice(0, 80).map(op => {
                  const isSelected = op.id === selectedId
                  const sub = 'unidade_uso' in op ? op.categoria ?? op.unidade_uso : op.rendimento_unidade
                  return (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => setSelectedId(op.id)}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-marrom-500/15 text-madrugada-800'
                          : 'text-demerara hover:bg-creme-100 hover:text-madrugada-800'
                      }`}
                    >
                      <span className="truncate">{op.nome}</span>
                      <span className={`text-xs shrink-0 ${isSelected ? 'text-marrom-500' : 'text-demerara/60'}`}>
                        {sub}
                      </span>
                    </button>
                  )
                })
              )}
            </div>

            {/* Selecionado */}
            {selected && (
              <div className="rounded-xl border border-marrom-500/20 bg-marrom-500/6 px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-madrugada-800 text-sm font-medium truncate">{selected.nome}</p>
                  <p className="text-demerara text-xs mt-0.5">
                    unidade: <span className="text-marrom-500">{unidadeDisplay}</span>
                  </p>
                </div>
              </div>
            )}

            {/* Quantidade */}
            <div>
              <label className="field-label">
                Quantidade{unidadeDisplay ? ` em ${unidadeDisplay}` : ''}
              </label>
              <input
                type="text"
                inputMode="decimal"
                name="quantidade"
                required
                defaultValue={isEdit ? item.quantidade.toString().replace('.', ',') : ''}
                placeholder={unidadeDisplay === 'g' ? '250' : unidadeDisplay === 'ml' ? '100' : '1'}
                className="input-field"
                disabled={!selectedId}
              />
              {!selectedId && <p className="text-demerara/50 text-xs mt-1">Selecione um item acima primeiro</p>}
            </div>

            {/* Erro */}
            {state?.error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-600 text-sm">
                {state.error}
              </div>
            )}

            {/* Botões */}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancelar</button>
              <button type="submit" disabled={pending || !selectedId} className="btn-primary flex-1">
                {pending ? 'Salvando…' : isEdit ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
