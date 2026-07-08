'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ChefHat, Pencil, Plus, Trash2, ListChecks, ListOrdered,
  Clock, Flame, Gauge, Lightbulb, Camera, Loader2, AlertTriangle, Tag,
} from 'lucide-react'
import { ItemModal } from '@/app/dashboard/receitas/components/item-modal'
import { ModoPreparoModal } from './modo-preparo-modal'
import { LogoPlaceholder } from '@/app/components/ui/logo-placeholder'
import { removeItem, uploadReceitaFoto, removeReceitaFoto } from '@/app/dashboard/receitas/actions'
import type { Receita, Dificuldade, ReceitaItemComCusto } from '@/app/dashboard/receitas/types'

export interface ItemCaderno {
  id: string
  insumo_id: string | null
  sub_receita_id: string | null
  quantidade: number
  nome: string
  unidade: string
  is_pendente: boolean
}

interface Props {
  receita: Receita
  itens: ItemCaderno[]
  podeEditar: boolean
}

const DIFICULDADE_LABEL: Record<Dificuldade, string> = { facil: 'Fácil', media: 'Média', dificil: 'Difícil' }

export function CadernoReceitaView({ receita, itens, podeEditar }: Props) {
  const router = useRouter()
  const [modoOpen, setModoOpen] = useState(false)
  const [itemModal, setItemModal] = useState<{ open: boolean; item: ReceitaItemComCusto | null; key: number }>({ open: false, item: null, key: 0 })
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [removendo, setRemovendo] = useState<string | null>(null)
  const [fotoUrl, setFotoUrl] = useState<string | null>(receita.foto_url)
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const [fotoErro, setFotoErro] = useState('')
  const keyRef = useRef(0)
  const fotoInputRef = useRef<HTMLInputElement>(null)

  const passos = receita.passos ?? []
  const temForno = receita.temperatura_forno != null || receita.tempo_forno_min != null

  function openAdd() { setItemModal({ open: true, item: null, key: (keyRef.current += 1) }) }
  function openEdit(it: ItemCaderno) {
    // ItemModal (edição) só usa id/insumo_id/sub_receita_id/quantidade/nome_display.
    const item: ReceitaItemComCusto = {
      id: it.id, receita_id: receita.id, insumo_id: it.insumo_id, sub_receita_id: it.sub_receita_id,
      quantidade: it.quantidade, insumo: null, sub_receita: null,
      nome_display: it.nome, unidade: it.unidade, custo_unitario: null, custo_item: null, is_pendente: it.is_pendente,
    }
    setItemModal({ open: true, item, key: (keyRef.current += 1) })
  }
  function closeItemModal() { setItemModal((m) => ({ ...m, open: false })); router.refresh() }

  async function handleRemove(id: string) {
    setRemovendo(id)
    await removeItem(id, receita.id)
    setRemovendo(null)
    setConfirmRemove(null)
    router.refresh()
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

  return (
    <div className="max-w-4xl mx-auto">
      {/* Voltar */}
      <Link href="/dashboard/caderno" className="inline-flex items-center gap-1.5 text-secondary hover:text-accent-primary text-sm mb-5 transition-all hover:-translate-x-0.5">
        <ArrowLeft size={16} />
        Voltar ao caderno
      </Link>

      {/* Cabeçalho */}
      <div className="card-surface px-6 py-5 mb-4">
        <div className="flex flex-col sm:flex-row gap-5">
          {/* Foto */}
          <div className="shrink-0">
            {fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fotoUrl} alt={receita.nome} className="w-full sm:w-40 h-40 rounded-2xl object-cover border border-subtle" />
            ) : (
              <LogoPlaceholder className="w-full sm:w-40 h-40 rounded-2xl" />
            )}
            {podeEditar && (
              <div className="flex items-center gap-2 mt-2 justify-center">
                <button onClick={() => fotoInputRef.current?.click()} disabled={enviandoFoto} className="text-[11px] text-secondary hover:text-accent-primary px-2 py-1 disabled:opacity-50 inline-flex items-center gap-1">
                  {enviandoFoto ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                  {enviandoFoto ? 'Enviando…' : fotoUrl ? 'Trocar' : 'Adicionar foto'}
                </button>
                {fotoUrl && !enviandoFoto && (
                  <>
                    <span className="text-secondary/30">·</span>
                    <button onClick={onRemoverFoto} className="text-[11px] text-secondary hover:text-red-400 px-1 py-1">Remover</button>
                  </>
                )}
                <input ref={fotoInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onFotoChange} className="hidden" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {receita.categoria?.trim() && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-primary/12 text-accent-primary border border-accent-primary/20 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
                  <Tag size={11} /> {receita.categoria.trim()}
                </span>
              )}
              {receita.revisao_pendente && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 px-2.5 py-0.5 text-[11px] font-medium">
                  <AlertTriangle size={12} /> Aguardando a Natali precificar
                </span>
              )}
            </div>
            <h1 className="font-playfair text-primary text-[28px] sm:text-[34px] font-bold leading-tight">{receita.nome}</h1>
            <p className="text-secondary text-sm mt-1">Rende {receita.rendimento} {receita.rendimento_unidade}</p>

            {(receita.tempo_preparo_min != null || temForno || receita.dificuldade) && (
              <div className="flex flex-wrap gap-2 mt-3">
                {receita.tempo_preparo_min != null && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-input border border-subtle px-3 py-1.5 text-xs text-primary"><Clock size={13} className="text-secondary" /> Preparo {receita.tempo_preparo_min} min</span>
                )}
                {temForno && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-input border border-subtle px-3 py-1.5 text-xs text-primary"><Flame size={13} className="text-secondary" /> Forno{receita.temperatura_forno != null && ` ${receita.temperatura_forno}°C`}{receita.tempo_forno_min != null && ` · ${receita.tempo_forno_min} min`}</span>
                )}
                {receita.dificuldade && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-input border border-subtle px-3 py-1.5 text-xs text-primary"><Gauge size={13} className="text-secondary" /> {DIFICULDADE_LABEL[receita.dificuldade]}</span>
                )}
              </div>
            )}

            {receita.observacao && (
              <p className="text-secondary text-sm mt-3 flex items-start gap-1.5"><Lightbulb size={14} className="text-amber-500 shrink-0 mt-0.5" />{receita.observacao}</p>
            )}

            <div className="flex gap-2 mt-4 flex-wrap">
              <Link href={`/dashboard/caderno/${receita.id}/cozinha`} className="btn-primary text-xs px-4 py-2 min-h-[36px]">
                <ChefHat size={14} /> Modo Cozinha
              </Link>
              {podeEditar && (
                <button onClick={() => setModoOpen(true)} className="btn-ghost text-xs px-4 py-2 min-h-[36px]">
                  <Pencil size={13} /> Editar modo de fazer
                </button>
              )}
            </div>
          </div>
        </div>
        {fotoErro && <p className="text-red-400 text-xs mt-2">{fotoErro}</p>}
      </div>

      {/* Ingredientes */}
      <div className="card-surface overflow-hidden mb-4">
        <div className="flex items-center justify-between px-5 py-3 border-b border-accent-primary/10 bg-input">
          <div className="flex items-center gap-2">
            <ListChecks size={15} className="text-accent-primary" />
            <span className="text-accent-primary text-[11px] uppercase tracking-widest font-semibold">Ingredientes</span>
            <span className="text-secondary/60 text-xs">({itens.length})</span>
          </div>
          {podeEditar && (
            <button onClick={openAdd} className="btn-primary text-xs px-3 py-1.5 min-h-[34px] rounded-lg"><Plus size={13} /> Adicionar</button>
          )}
        </div>

        {itens.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-secondary text-sm">Nenhum ingrediente ainda.</p>
            {podeEditar && (
              <button onClick={openAdd} className="btn-primary mt-4 text-sm px-4 py-2 min-h-[40px]"><Plus size={14} /> Adicionar ingredientes</button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-accent-primary/8">
            {itens.map((it) => (
              <li key={it.id} className={`flex items-center justify-between gap-3 px-5 py-3 ${it.is_pendente ? 'bg-amber-500/8' : ''}`}>
                <div className="min-w-0 flex items-center gap-2">
                  {it.is_pendente && <AlertTriangle size={13} className="text-amber-500 shrink-0" />}
                  <span className="text-primary text-[15px] truncate">
                    <span className="tabular-nums font-semibold">{it.quantidade} {it.unidade}</span>
                    <span className="text-secondary"> · {it.nome}</span>
                    {it.sub_receita_id && <span className="ml-2 text-[10px] text-blue-400 italic">sub-receita</span>}
                  </span>
                </div>
                {podeEditar && (
                  confirmRemove === it.id ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => handleRemove(it.id)} disabled={removendo === it.id} className="text-[11px] font-medium text-red-400 border border-red-500/30 rounded-lg px-2.5 py-1.5 hover:bg-red-500/10 transition-colors">{removendo === it.id ? '…' : 'Excluir'}</button>
                      <button onClick={() => setConfirmRemove(null)} className="text-[11px] text-secondary hover:text-primary px-2 py-1.5">Cancelar</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => openEdit(it)} className="inline-flex items-center gap-1 text-xs text-secondary hover:text-accent-primary border border-subtle hover:border-accent-primary/30 hover:bg-accent-primary/8 rounded-lg px-2.5 py-1.5 transition-all" aria-label="Editar ingrediente"><Pencil size={12} /> Editar</button>
                      <button onClick={() => setConfirmRemove(it.id)} className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-secondary hover:text-red-400 border border-subtle hover:border-red-500/30 hover:bg-red-500/8 transition-all" aria-label="Excluir ingrediente"><Trash2 size={13} /></button>
                    </div>
                  )
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modo de preparo */}
      <div className="card-surface overflow-hidden mb-4">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-accent-primary/10 bg-input">
          <ListOrdered size={15} className="text-accent-primary" />
          <span className="text-accent-primary text-[11px] uppercase tracking-widest font-semibold">Modo de preparo</span>
          {passos.length > 0 && <span className="text-secondary/60 text-xs">({passos.length} passo{passos.length > 1 ? 's' : ''})</span>}
        </div>
        {passos.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-secondary text-sm">Nenhum passo cadastrado ainda.</p>
            {podeEditar && (
              <button onClick={() => setModoOpen(true)} className="btn-ghost mt-4 text-sm px-4 py-2 min-h-[40px]"><Pencil size={14} /> Escrever o modo de preparo</button>
            )}
          </div>
        ) : (
          <ol className="divide-y divide-accent-primary/8">
            {passos.map((passo, i) => (
              <li key={i} className="flex items-start gap-3.5 px-5 py-3.5">
                <span className="shrink-0 w-7 h-7 rounded-full bg-accent-primary/15 text-accent-primary flex items-center justify-center text-sm font-semibold tabular-nums">{i + 1}</span>
                <p className="text-primary text-[15px] leading-relaxed pt-0.5">{passo}</p>
              </li>
            ))}
          </ol>
        )}
      </div>

      {modoOpen && <ModoPreparoModal receita={receita} onClose={() => { setModoOpen(false); router.refresh() }} />}
      {itemModal.open && <ItemModal key={itemModal.key} receitaId={receita.id} item={itemModal.item} onClose={closeItemModal} />}
    </div>
  )
}
