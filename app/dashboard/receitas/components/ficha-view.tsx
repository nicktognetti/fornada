'use client'

import { useState, useRef } from 'react'
import { Plus, Pencil, Trash2, AlertTriangle, BookOpen, ListOrdered, ChefHat, Camera, Loader2, Clock, Flame, Gauge, Lightbulb, BadgeCheck } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { deleteReceita, removeItem, uploadReceitaFoto, removeReceitaFoto, marcarReceitaRevisada } from '../actions'
import { formatBRL, formatCustoGrande } from '@/lib/format'
import { ReceitaModal } from './receita-modal'
import { ItemModal } from './item-modal'
import { DocumentoImpressao, BotaoImprimir, tabelaImpressao as T } from '@/app/components/ui/documento-impressao'
import type { Receita, ReceitaItemComCusto, Dificuldade } from '../types'

interface Props {
  receita: Receita
  custo: { custo_total: number | null; custo_unitario: number | null } | null
  itens: ReceitaItemComCusto[]
}

const TIPO_LABEL: Record<string, string> = { final: 'Final', base: 'Base' }
const DIFICULDADE_LABEL: Record<Dificuldade, string> = { facil: 'Fácil', media: 'Média', dificil: 'Difícil' }

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
  const [confirmItemId, setConfirmItemId] = useState<string | null>(null)
  const [fotoUrl, setFotoUrl] = useState<string | null>(receita.foto_url)
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const [fotoErro, setFotoErro] = useState('')
  const [revisando, setRevisando] = useState(false)
  const keyRef = useRef(0)
  const fotoInputRef = useRef<HTMLInputElement>(null)

  async function handleMarcarRevisada() {
    setRevisando(true)
    const res = await marcarReceitaRevisada(receita.id)
    setRevisando(false)
    if (!res.error) router.refresh()
  }

  function openEditReceita() { setEditReceitaKey(keyRef.current += 1); setEditReceitaOpen(true) }
  function openAddItem() { setItemModal({ open: true, item: null, key: (keyRef.current += 1) }) }
  function openEditItem(item: ReceitaItemComCusto) { setItemModal({ open: true, item, key: (keyRef.current += 1) }) }

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
    setConfirmItemId(null)
  }

  async function onFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setFotoErro('Imagem muito grande (máx. 5 MB)'); return }
    setFotoErro('')
    setEnviandoFoto(true)
    const fd = new FormData()
    fd.append('foto', file)
    const res = await uploadReceitaFoto(receita.id, fd)
    setEnviandoFoto(false)
    if (res.error || !res.data) setFotoErro(res.error ?? 'Falha no upload')
    else setFotoUrl(res.data.foto_url)
  }

  async function onRemoverFoto() {
    const anterior = fotoUrl
    setFotoUrl(null)
    const res = await removeReceitaFoto(receita.id)
    if (res.error) { setFotoUrl(anterior); setFotoErro(res.error) }
  }

  const pendentes = itens.filter(i => i.is_pendente)
  const normais = itens.filter(i => !i.is_pendente)
  const passos = receita.passos ?? []
  const temForno = receita.temperatura_forno != null || receita.tempo_forno_min != null

  return (
    <>
      {/* Header da ficha */}
      <div className="card-surface px-6 py-5 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-accent-primary/15 text-accent-primary border border-accent-primary/20">
                {TIPO_LABEL[receita.tipo] ?? receita.tipo}
              </span>
              <span className="text-secondary text-xs">
                Rende {receita.rendimento} {receita.rendimento_unidade}
              </span>
            </div>
            <h1 className="font-playfair text-primary text-[28px] sm:text-[34px] font-bold leading-tight">
              {receita.nome}
            </h1>
            {receita.observacao && (
              <p className="text-secondary text-sm mt-2 flex items-start gap-1.5">
                <Lightbulb size={14} className="text-amber-500 shrink-0 mt-0.5" />
                {receita.observacao}
              </p>
            )}

            {/* Chips de tempo/forno/dificuldade */}
            {(receita.tempo_preparo_min != null || temForno || receita.dificuldade) && (
              <div className="flex flex-wrap gap-2 mt-4">
                {receita.tempo_preparo_min != null && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-input border border-subtle px-3 py-1.5 text-xs text-primary">
                    <Clock size={13} className="text-secondary" /> Preparo {receita.tempo_preparo_min} min
                  </span>
                )}
                {temForno && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-input border border-subtle px-3 py-1.5 text-xs text-primary">
                    <Flame size={13} className="text-secondary" /> Forno
                    {receita.temperatura_forno != null && ` ${receita.temperatura_forno}°C`}
                    {receita.tempo_forno_min != null && ` · ${receita.tempo_forno_min} min`}
                  </span>
                )}
                {receita.dificuldade && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-input border border-subtle px-3 py-1.5 text-xs text-primary">
                    <Gauge size={13} className="text-secondary" /> {DIFICULDADE_LABEL[receita.dificuldade]}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Foto do resultado */}
          <div className="shrink-0 flex flex-col items-center gap-2">
            {fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fotoUrl} alt={receita.nome}
                className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl object-cover border border-subtle" />
            ) : (
              <button onClick={() => fotoInputRef.current?.click()} disabled={enviandoFoto}
                className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-input border border-dashed border-subtle flex flex-col items-center justify-center gap-1.5 text-secondary/60 hover:text-accent-primary hover:border-accent-primary/40 transition-all disabled:opacity-50">
                {enviandoFoto ? <Loader2 size={22} className="animate-spin" /> : <Camera size={22} />}
                <span className="text-[11px]">{enviandoFoto ? 'Enviando…' : 'Adicionar foto'}</span>
              </button>
            )}
            {fotoUrl && (
              <div className="flex items-center gap-1">
                <button onClick={() => fotoInputRef.current?.click()} disabled={enviandoFoto}
                  className="text-[11px] text-secondary hover:text-accent-primary px-2 py-1 disabled:opacity-50">
                  {enviandoFoto ? 'Enviando…' : 'Trocar'}
                </button>
                <span className="text-secondary/30">·</span>
                <button onClick={onRemoverFoto} disabled={enviandoFoto}
                  className="text-[11px] text-secondary hover:text-red-400 px-2 py-1 disabled:opacity-50">
                  Remover
                </button>
              </div>
            )}
            <input ref={fotoInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onFotoChange} className="hidden" />
          </div>
        </div>
        {fotoErro && <p className="text-red-400 text-xs mt-2">{fotoErro}</p>}

        {custo?.custo_total != null && custo.custo_total > 0 && (
          <div className="mt-4 pt-4 border-t border-accent-primary/10 flex items-center justify-between">
            <span className="field-label mb-0">Custo total</span>
            <div className="text-right">
              <span className="font-playfair text-accent-primary text-[26px] font-bold leading-none tabular-nums">
                R$ {formatBRL(custo.custo_total)}
              </span>
              {custo.custo_unitario != null && (
                <p className="text-secondary text-xs mt-1 tabular-nums">
                  {formatCustoGrande(custo.custo_unitario, receita.rendimento_unidade)}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-5 pt-4 border-t border-accent-primary/10 flex-wrap">
          <Link href={`/dashboard/receitas/${receita.id}/cozinha`} className="btn-primary text-xs px-4 py-2 min-h-[36px]">
            <ChefHat size={14} />
            Modo Cozinha
          </Link>
          <button onClick={openEditReceita} className="btn-ghost text-xs px-4 py-2 min-h-[36px]">
            <Pencil size={13} />
            Editar ficha
          </button>
          <BotaoImprimir className="text-xs px-4 py-2" />
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
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-secondary hover:text-primary px-2 py-1.5">
                Cancelar
              </button>
            </div>
          )}
        </div>
        {deleteError && <p className="text-red-400 text-xs mt-2">{deleteError}</p>}
      </div>

      {/* Aviso de revisão — receita criada/alterada pela produção no Caderno */}
      {receita.revisao_pendente && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 mb-4">
          <div className="flex items-start gap-3 flex-1">
            <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300 text-sm font-medium">Receita nova da produção — precisa de preço</p>
              <p className="text-amber-400/70 text-xs mt-0.5">
                Confira os ingredientes e as quantidades, defina o preço de venda e marque como revisada.
              </p>
            </div>
          </div>
          <button
            onClick={handleMarcarRevisada}
            disabled={revisando}
            className="btn-primary text-xs px-4 py-2 min-h-[36px] shrink-0 self-start sm:self-auto"
          >
            <BadgeCheck size={14} />
            {revisando ? 'Salvando…' : 'Marcar como revisada'}
          </button>
        </div>
      )}

      {/* Alerta pendentes */}
      {pendentes.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 mb-4">
          <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-300 text-sm font-medium">
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
        <div className="flex items-center justify-between px-5 py-3 border-b border-accent-primary/10 bg-input">
          <div className="flex items-center gap-2">
            <BookOpen size={15} className="text-accent-primary" />
            <span className="text-accent-primary text-[11px] uppercase tracking-widest font-semibold">
              Ingredientes
            </span>
            <span className="text-secondary/60 text-xs">({itens.length})</span>
          </div>
          <button onClick={openAddItem} className="btn-primary text-xs px-3 py-1.5 min-h-[34px] rounded-lg">
            <Plus size={13} />
            Adicionar
          </button>
        </div>

        {itens.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-secondary text-sm">Nenhum ingrediente cadastrado.</p>
            <button onClick={openAddItem} className="btn-primary mt-4 text-sm px-4 py-2 min-h-[40px]">
              <Plus size={14} />
              Adicionar primeiro item
            </button>
          </div>
        ) : (
          <div>
            {/* Desktop (telas largas): tabela */}
            <div className="hidden lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-input text-secondary text-[11px] uppercase tracking-wider">
                    <th className="text-left px-5 py-2.5 font-semibold">Ingrediente</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Qtd</th>
                    <th className="text-left px-2 py-2.5 font-semibold w-12">Un</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Custo/un</th>
                    <th className="text-right px-5 py-2.5 font-semibold">Custo item</th>
                    <th className="text-center px-4 py-2.5 font-semibold w-28">Status</th>
                    <th className="px-4 py-2.5 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-accent-primary/8">
                  {[...pendentes, ...normais].map(item => (
                    <tr key={item.id} className={`transition-colors ${item.is_pendente ? 'bg-amber-500/8' : 'hover:bg-accent-primary/3'}`}>
                      <td className="px-5 py-3 max-w-[280px]">
                        <div className="flex items-center gap-2">
                          {item.is_pendente && <AlertTriangle size={13} className="text-amber-500 shrink-0" />}
                          <span className={`font-medium truncate block ${item.is_pendente ? 'text-amber-400' : 'text-primary'}`} title={item.nome_display}>
                            {item.nome_display}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-primary tabular-nums">{item.quantidade}</td>
                      <td className="px-2 py-3 text-secondary">{item.unidade}</td>
                      <td className="px-4 py-3 text-right text-secondary text-xs tabular-nums">
                        {item.custo_unitario != null ? formatCustoGrande(item.custo_unitario, item.unidade) : '—'}
                      </td>
                      <td className="px-5 py-3 text-right font-playfair font-semibold text-[15px] text-primary tabular-nums">
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
                        {confirmItemId === item.id ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => handleRemoveItem(item)} disabled={deletingItemId === item.id} className="text-[11px] font-medium text-red-400 border border-red-500/30 rounded-lg px-2.5 py-1.5 hover:bg-red-500/10 transition-colors">
                              {deletingItemId === item.id ? '…' : 'Excluir'}
                            </button>
                            <button onClick={() => setConfirmItemId(null)} className="text-[11px] text-secondary hover:text-primary px-2 py-1.5">Cancelar</button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => openEditItem(item)} className="inline-flex items-center gap-1 text-xs text-secondary hover:text-accent-primary border border-subtle hover:border-accent-primary/30 hover:bg-accent-primary/8 rounded-lg px-2.5 py-1.5 transition-all" aria-label="Editar item">
                              <Pencil size={12} /> Editar
                            </button>
                            <button onClick={() => setConfirmItemId(item.id)} className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-secondary hover:text-red-400 border border-subtle hover:border-red-500/30 hover:bg-red-500/8 transition-all" aria-label="Excluir item">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tablet e celular: cards (ações sempre visíveis) */}
            <div className="lg:hidden divide-y divide-accent-primary/8">
              {[...pendentes, ...normais].map(item => (
                <div key={item.id} className={`px-4 py-3 ${item.is_pendente ? 'bg-amber-500/8' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {item.is_pendente && <AlertTriangle size={13} className="text-amber-500 shrink-0" />}
                        <p className={`text-sm font-medium truncate ${item.is_pendente ? 'text-amber-400' : 'text-primary'}`}>
                          {item.nome_display}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-secondary text-xs">
                          {item.quantidade} {item.unidade}
                          {item.custo_item != null && (
                            <span className="ml-2 text-primary font-playfair text-sm">R$ {formatBRL(item.custo_item)}</span>
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
                    {confirmItemId === item.id ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => handleRemoveItem(item)} disabled={deletingItemId === item.id} className="text-[11px] font-medium text-red-400 border border-red-500/30 rounded-lg px-2.5 py-1.5 hover:bg-red-500/10 transition-colors">
                          {deletingItemId === item.id ? '…' : 'Excluir'}
                        </button>
                        <button onClick={() => setConfirmItemId(null)} className="text-[11px] text-secondary px-2 py-1.5">Cancelar</button>
                      </div>
                    ) : (
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => openEditItem(item)} className="inline-flex items-center gap-1 text-xs text-secondary hover:text-accent-primary border border-subtle hover:border-accent-primary/30 hover:bg-accent-primary/8 rounded-lg px-2.5 py-1.5 transition-all" aria-label="Editar item">
                          <Pencil size={13} /> Editar
                        </button>
                        <button onClick={() => setConfirmItemId(item.id)} className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-secondary hover:text-red-400 border border-subtle hover:border-red-500/30 hover:bg-red-500/8 transition-all" aria-label="Excluir item">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Rodapé total */}
            {custo?.custo_total != null && custo.custo_total > 0 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-accent-primary/10 bg-input">
                <span className="text-secondary text-sm">Total da ficha</span>
                <span className="font-playfair text-accent-primary text-[22px] font-bold leading-none tabular-nums">
                  R$ {formatBRL(custo.custo_total)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modo de preparo */}
      <div className="card-surface overflow-hidden mb-4">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-accent-primary/10 bg-input">
          <ListOrdered size={15} className="text-accent-primary" />
          <span className="text-accent-primary text-[11px] uppercase tracking-widest font-semibold">
            Modo de preparo
          </span>
          {passos.length > 0 && <span className="text-secondary/60 text-xs">({passos.length} passo{passos.length > 1 ? 's' : ''})</span>}
        </div>

        {passos.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-secondary text-sm">Nenhum passo cadastrado ainda.</p>
            <button onClick={openEditReceita} className="btn-ghost mt-4 text-sm px-4 py-2 min-h-[40px]">
              <Pencil size={14} />
              Escrever o modo de preparo
            </button>
          </div>
        ) : (
          <ol className="divide-y divide-accent-primary/8">
            {passos.map((passo, i) => (
              <li key={i} className="flex items-start gap-3.5 px-5 py-3.5">
                <span className="shrink-0 w-7 h-7 rounded-full bg-accent-primary/15 text-accent-primary flex items-center justify-center text-sm font-semibold tabular-nums">
                  {i + 1}
                </span>
                <p className="text-primary text-[15px] leading-relaxed pt-0.5">{passo}</p>
              </li>
            ))}
          </ol>
        )}
      </div>

      {editReceitaOpen && (
        <ReceitaModal key={editReceitaKey} receita={receita} onClose={() => setEditReceitaOpen(false)} />
      )}
      {itemModal.open && (
        <ItemModal key={itemModal.key} receitaId={receita.id} item={itemModal.item} onClose={() => setItemModal(m => ({ ...m, open: false }))} />
      )}

      {/* Documento de impressão (oculto na tela) */}
      <DocumentoImpressao
        titulo={`Ficha Técnica — ${receita.nome}`}
        subtitulo={`Rende ${receita.rendimento} ${receita.rendimento_unidade} · ${TIPO_LABEL[receita.tipo] ?? receita.tipo}`}
      >
        {(receita.tempo_preparo_min != null || temForno || receita.dificuldade) && (
          <p style={{ marginBottom: '10px', fontSize: '11px', color: '#333' }}>
            {receita.tempo_preparo_min != null && `Preparo: ${receita.tempo_preparo_min} min`}
            {temForno && `${receita.tempo_preparo_min != null ? '  ·  ' : ''}Forno: ${receita.temperatura_forno != null ? `${receita.temperatura_forno}°C` : ''}${receita.tempo_forno_min != null ? ` por ${receita.tempo_forno_min} min` : ''}`}
            {receita.dificuldade && `  ·  Dificuldade: ${DIFICULDADE_LABEL[receita.dificuldade]}`}
          </p>
        )}
        <table style={T.table}>
          <thead>
            <tr>
              <th style={T.th}>Ingrediente</th>
              <th style={T.thRight}>Qtd</th>
              <th style={T.th}>Un</th>
              <th style={T.thRight}>Custo/un</th>
              <th style={T.thRight}>Custo item</th>
            </tr>
          </thead>
          <tbody>
            {[...pendentes, ...normais].map((item) => (
              <tr key={item.id}>
                <td style={T.td}>{item.nome_display}</td>
                <td style={T.tdRight}>{item.quantidade}</td>
                <td style={T.td}>{item.unidade}</td>
                <td style={T.tdRight}>{item.custo_unitario != null ? formatCustoGrande(item.custo_unitario, item.unidade) : '—'}</td>
                <td style={T.tdRight}>{item.custo_item != null ? `R$ ${formatBRL(item.custo_item)}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {custo?.custo_total != null && custo.custo_total > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '8px', borderTop: '2px solid #1a1a1a', fontWeight: 700, fontSize: '14px' }}>
            <span>Custo total</span>
            <span>R$ {formatBRL(custo.custo_total)}{custo.custo_unitario != null ? ` (${formatCustoGrande(custo.custo_unitario, receita.rendimento_unidade)})` : ''}</span>
          </div>
        )}
        {passos.length > 0 && (
          <div style={{ marginTop: '18px' }}>
            <p style={{ fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>Modo de preparo</p>
            <ol style={{ margin: 0, paddingLeft: '18px' }}>
              {passos.map((passo, i) => (
                <li key={i} style={{ fontSize: '12px', color: '#222', marginBottom: '6px', lineHeight: 1.5 }}>{passo}</li>
              ))}
            </ol>
          </div>
        )}
        {receita.observacao && <p style={{ marginTop: '12px', fontSize: '11px', color: '#555' }}>Dica: {receita.observacao}</p>}
      </DocumentoImpressao>
    </>
  )
}
