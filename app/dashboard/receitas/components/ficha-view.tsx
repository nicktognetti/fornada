'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, AlertTriangle, BookOpen } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { deleteReceita, removeItem } from '../actions'
import { formatBRL, formatCustoUso } from '@/lib/format'
import { ReceitaModal } from './receita-modal'
import { ItemModal } from './item-modal'
import type { Receita, ReceitaItemComCusto } from '../types'

interface Props {
  receita: Receita
  custo: { custo_total: number | null; custo_unitario: number | null } | null
  itens: ReceitaItemComCusto[]
}

const TIPO_LABEL: Record<string, string> = { final: 'Final', base: 'Base' }

export function FichaView({ receita, custo, itens }: Props) {
  const router = useRouter()
  const [editReceitaOpen, setEditReceitaOpen] = useState(false)
  const [editReceitaKey, setEditReceitaKey] = useState(0)
  const [itemModal, setItemModal] = useState<{ open: boolean; item: ReceitaItemComCusto | null; key: number }>({
    open: false, item: null, key: 0,
  })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null)

  function openEditReceita() { setEditReceitaKey(Date.now()); setEditReceitaOpen(true) }
  function openAddItem() { setItemModal({ open: true, item: null, key: Date.now() }) }
  function openEditItem(item: ReceitaItemComCusto) { setItemModal({ open: true, item, key: Date.now() }) }

  async function handleDeleteReceita() {
    setDeleteError('')
    const result = await deleteReceita(receita.id)
    if (result.error) { setDeleteError(result.error); setConfirmDelete(false) }
    else router.push('/dashboard/receitas')
  }

  async function handleRemoveItem(item: ReceitaItemComCusto) {
    setDeletingItemId(item.id)
    await removeItem(item.id, receita.id)
    setDeletingItemId(null)
  }

  const pendentes = itens.filter(i => i.is_pendente)
  const normais = itens.filter(i => !i.is_pendente)

  return (
    <>
      {/* Header da ficha */}
      <div className="card-surface px-6 py-5 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#d68a57]/15 text-[#d68a57] border border-[#d68a57]/20">
                {TIPO_LABEL[receita.tipo] ?? receita.tipo}
              </span>
              <span className="text-[#9e9e9e] text-xs">
                Rende {receita.rendimento} {receita.rendimento_unidade}
              </span>
            </div>
            <h1 className="font-playfair text-[#e8e6e3] text-[28px] sm:text-[34px] font-bold leading-tight">
              {receita.nome}
            </h1>
            {receita.observacao && (
              <p className="text-[#9e9e9e] text-sm mt-2">{receita.observacao}</p>
            )}
          </div>

          {custo?.custo_total != null && custo.custo_total > 0 && (
            <div className="shrink-0 text-right">
              <p className="field-label mb-1">Custo total</p>
              <p className="font-playfair text-[#d68a57] text-[30px] sm:text-[36px] font-bold leading-none">
                R$ {formatBRL(custo.custo_total)}
              </p>
              {custo.custo_unitario != null && (
                <p className="text-[#9e9e9e] text-xs mt-1">
                  R$ {formatBRL(custo.custo_unitario)}/{receita.rendimento_unidade}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-5 pt-4 border-t border-[rgba(255,255,255,0.07)]">
          <button onClick={openEditReceita} className="btn-ghost text-xs px-4 py-2 min-h-[36px]">
            <Pencil size={13} />
            Editar ficha
          </button>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="btn-ghost text-xs px-4 py-2 min-h-[36px] border-red-500/20 text-red-400/70 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/8"
            >
              <Trash2 size={13} />
              Excluir
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-red-400 text-xs">Confirmar exclusão?</span>
              <button onClick={handleDeleteReceita} className="text-xs text-red-400 border border-red-500/30 hover:bg-red-500/10 rounded-lg px-3 py-1.5 transition-colors">
                Sim, excluir
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-[#9e9e9e] hover:text-[#e8e6e3] px-2 py-1.5">
                Cancelar
              </button>
            </div>
          )}
        </div>
        {deleteError && <p className="text-red-400 text-xs mt-2">{deleteError}</p>}
      </div>

      {/* Alerta pendentes */}
      {pendentes.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 mb-4">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-400 text-sm font-medium">
              {pendentes.length} item{pendentes.length > 1 ? 'ns' : ''} sem insumo definido
            </p>
            <p className="text-amber-400/70 text-xs mt-0.5">
              Edite os itens destacados abaixo para vincular ao insumo correto.
            </p>
          </div>
        </div>
      )}

      {/* Tabela de itens */}
      <div className="card-surface overflow-hidden mb-4">
        {/* Header tabela */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(255,255,255,0.07)] bg-[#1e1e22]">
          <div className="flex items-center gap-2">
            <BookOpen size={15} className="text-[#d68a57]" />
            <span className="text-[#d68a57] text-[11px] uppercase tracking-widest font-semibold">
              Ingredientes
            </span>
            <span className="text-[#9e9e9e]/60 text-xs">({itens.length})</span>
          </div>
          <button onClick={openAddItem} className="btn-primary text-xs px-3 py-1.5 min-h-[34px] rounded-lg">
            <Plus size={13} />
            Adicionar
          </button>
        </div>

        {itens.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[#9e9e9e] text-sm">Nenhum ingrediente cadastrado.</p>
            <button onClick={openAddItem} className="btn-primary mt-4 text-sm px-4 py-2 min-h-[40px]">
              <Plus size={14} />
              Adicionar primeiro item
            </button>
          </div>
        ) : (
          <div>
            {/* Desktop: tabela */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1a1a1d] text-[#9e9e9e] text-[11px] uppercase tracking-wider">
                    <th className="text-left px-5 py-2.5 font-semibold">Ingrediente</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Qtd</th>
                    <th className="text-left px-2 py-2.5 font-semibold w-12">Un</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Custo/un</th>
                    <th className="text-right px-5 py-2.5 font-semibold">Custo item</th>
                    <th className="text-center px-4 py-2.5 font-semibold w-28">Status</th>
                    <th className="px-4 py-2.5 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(255,255,255,0.05)]">
                  {[...pendentes, ...normais].map(item => (
                    <tr key={item.id} className={`transition-colors ${item.is_pendente ? 'bg-amber-500/8' : 'hover:bg-[rgba(255,255,255,0.02)]'}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {item.is_pendente && <AlertTriangle size={13} className="text-amber-400 shrink-0" />}
                          <span className={`font-medium ${item.is_pendente ? 'text-amber-400' : 'text-[#e8e6e3]'}`}>
                            {item.nome_display}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-[#e8e6e3]">{item.quantidade}</td>
                      <td className="px-2 py-3 text-[#9e9e9e]">{item.unidade}</td>
                      <td className="px-4 py-3 text-right text-[#9e9e9e] text-xs">
                        {item.custo_unitario != null ? formatCustoUso(item.custo_unitario, item.unidade) : '—'}
                      </td>
                      <td className="px-5 py-3 text-right font-playfair font-semibold text-[15px] text-[#e8e6e3]">
                        {item.custo_item != null ? `R$ ${formatBRL(item.custo_item)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.is_pendente ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/25">
                            Pendente
                          </span>
                        ) : item.sub_receita_id ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/25 italic">
                            Sub-receita
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditItem(item)} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#9e9e9e]/40 hover:text-[#d68a57] hover:bg-[#d68a57]/10 transition-all" aria-label="Editar">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => handleRemoveItem(item)} disabled={deletingItemId === item.id} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#9e9e9e]/40 hover:text-red-400 hover:bg-red-500/10 transition-all" aria-label="Remover">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: cards */}
            <div className="md:hidden divide-y divide-[rgba(255,255,255,0.05)]">
              {[...pendentes, ...normais].map(item => (
                <div key={item.id} className={`px-4 py-3 ${item.is_pendente ? 'bg-amber-500/8' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {item.is_pendente && <AlertTriangle size={13} className="text-amber-400 shrink-0" />}
                        <p className={`text-sm font-medium truncate ${item.is_pendente ? 'text-amber-400' : 'text-[#e8e6e3]'}`}>
                          {item.nome_display}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[#9e9e9e] text-xs">
                          {item.quantidade} {item.unidade}
                          {item.custo_item != null && (
                            <span className="ml-2 text-[#e8e6e3] font-playfair text-sm">R$ {formatBRL(item.custo_item)}</span>
                          )}
                        </p>
                        {item.is_pendente ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/25">
                            Pendente
                          </span>
                        ) : item.sub_receita_id ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/25 italic">
                            Sub-receita
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEditItem(item)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9e9e9e]/40 hover:text-[#d68a57] hover:bg-[#d68a57]/10 transition-all">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleRemoveItem(item)} disabled={deletingItemId === item.id} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9e9e9e]/40 hover:text-red-400 hover:bg-red-500/10 transition-all">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Rodapé total */}
            {custo?.custo_total != null && custo.custo_total > 0 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-[rgba(255,255,255,0.07)] bg-[#1e1e22]">
                <span className="text-[#9e9e9e] text-sm">Total da ficha</span>
                <span className="font-playfair text-[#d68a57] text-[22px] font-bold leading-none">
                  R$ {formatBRL(custo.custo_total)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {editReceitaOpen && (
        <ReceitaModal key={editReceitaKey} receita={receita} onClose={() => setEditReceitaOpen(false)} />
      )}
      {itemModal.open && (
        <ItemModal key={itemModal.key} receitaId={receita.id} item={itemModal.item} onClose={() => setItemModal(m => ({ ...m, open: false }))} />
      )}
    </>
  )
}
