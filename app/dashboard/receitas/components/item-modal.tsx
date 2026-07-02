'use client'

import { useActionState, useEffect, useState, useRef, useTransition } from 'react'
import { X, ShoppingCart, Plus, Trash2 } from 'lucide-react'
import { addItensLote, updateItem, getInsumos, getReceitasParaSubReceita } from '../actions'
import { SectionLabel } from '@/app/components/ui/section-label'
import { normalizeSearch, parseDecimalBR } from '@/lib/format'
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

/** Dispatcher: editar 1 item (form clássico) ou adicionar vários (modo lista). */
export function ItemModal({ receitaId, item, onClose }: Props) {
  return item
    ? <ItemEditModal receitaId={receitaId} item={item} onClose={onClose} />
    : <ItemAddModal receitaId={receitaId} onClose={onClose} />
}

// ── Hook compartilhado: carrega insumos + sub-receitas ────────────────────────
function useOpcoes(receitaId: string) {
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
  return { insumos, subReceitas, loading }
}

function unidadeDe(op: InsumoOpcao | SubReceitaOpcao | undefined): string | null {
  if (!op) return null
  return 'unidade_uso' in op ? op.unidade_uso : op.rendimento_unidade
}

// ── Modal de ADIÇÃO em lista (vários itens, salva 1x) ─────────────────────────

interface Staged {
  key: number
  tipo: TipoItem
  id: string
  nome: string
  unidade: string | null
  quantidade: number
  quantidadeStr: string
}

function ItemAddModal({ receitaId, onClose }: { receitaId: string; onClose: () => void }) {
  const { insumos, subReceitas, loading } = useOpcoes(receitaId)
  const [tipo, setTipo] = useState<TipoItem>('insumo')
  const [busca, setBusca] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [staged, setStaged] = useState<Staged[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [saving, startSave] = useTransition()
  const keyRef = useRef(0)
  const buscaRef = useRef<HTMLInputElement>(null)

  const termNorm = normalizeSearch(busca)
  const opcoes = tipo === 'insumo'
    ? insumos.filter(i => !termNorm || normalizeSearch(i.nome).includes(termNorm) || normalizeSearch(i.categoria ?? '').includes(termNorm))
    : subReceitas.filter(s => !termNorm || normalizeSearch(s.nome).includes(termNorm))

  const selected = tipo === 'insumo'
    ? insumos.find(i => i.id === selectedId)
    : subReceitas.find(s => s.id === selectedId)
  const unidadeDisplay = unidadeDe(selected)

  const jaNaLista = (t: TipoItem, id: string) => staged.some(s => s.tipo === t && s.id === id)

  function handleTipoChange(t: TipoItem) {
    setTipo(t); setBusca(''); setSelectedId(''); setErro(null)
  }

  function adicionarNaLista() {
    if (!selectedId || !selected) { setErro('Selecione um item acima'); return }
    if (jaNaLista(tipo, selectedId)) { setErro('Esse item já está na lista'); return }
    const q = parseDecimalBR(quantidade)
    if (!(q > 0)) { setErro('Informe uma quantidade maior que zero'); return }
    setStaged(prev => [...prev, {
      key: (keyRef.current += 1), tipo, id: selectedId, nome: selected.nome,
      unidade: unidadeDisplay, quantidade: q, quantidadeStr: quantidade,
    }])
    // Limpa o seletor pro próximo item, mantém o tipo e volta o foco pra busca.
    setSelectedId(''); setBusca(''); setQuantidade(''); setErro(null)
    setTimeout(() => buscaRef.current?.focus(), 0)
  }

  function removerDaLista(key: number) {
    setStaged(prev => prev.filter(s => s.key !== key))
  }

  function salvar() {
    // Inclui um item pendente no seletor (se houver) para não perder a digitação.
    let lista = staged
    const q = parseDecimalBR(quantidade)
    if (selectedId && selected && q > 0 && !jaNaLista(tipo, selectedId)) {
      lista = [...staged, {
        key: -1, tipo, id: selectedId, nome: selected.nome,
        unidade: unidadeDisplay, quantidade: q, quantidadeStr: quantidade,
      }]
    }
    if (lista.length === 0) { setErro('Adicione ao menos um item à lista'); return }
    setErro(null)
    const payload = lista.map(s => ({
      insumo_id: s.tipo === 'insumo' ? s.id : null,
      sub_receita_id: s.tipo === 'sub_receita' ? s.id : null,
      quantidade: s.quantidade,
    }))
    startSave(async () => {
      const res = await addItensLote(receitaId, payload)
      if (res.error) { setErro(res.error); return }
      onClose()
    })
  }

  const totalItens = staged.length

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-2xl border border-accent-primary/12 shadow-[0_8px_40px_rgba(0,0,0,0.12)] w-full max-w-lg max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-accent-primary/10 shrink-0">
          <div>
            <h2 className="font-playfair text-primary text-[22px] font-bold leading-tight">Adicionar Itens</h2>
            <p className="text-secondary text-xs mt-0.5">Monte a lista e salve tudo de uma vez</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:text-accent-primary hover:bg-accent-primary/10 transition-all" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Tipo toggle */}
          <div>
            <SectionLabel icon={ShoppingCart}>Tipo de item</SectionLabel>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {(['insumo', 'sub_receita'] as TipoItem[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTipoChange(t)}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                    tipo === t
                      ? 'bg-accent-primary/15 border-accent-primary/30 text-accent-primary'
                      : 'bg-transparent border-accent-primary/15 text-secondary hover:text-primary hover:border-accent-primary/25'
                  }`}
                >
                  {t === 'insumo' ? 'Insumo' : 'Sub-receita'}
                </button>
              ))}
            </div>
          </div>

          {/* Busca */}
          <div>
            <label className="field-label">{tipo === 'insumo' ? 'Buscar insumo' : 'Buscar sub-receita'}</label>
            <input
              ref={buscaRef}
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder={tipo === 'insumo' ? 'Digite o nome ou categoria…' : 'Digite o nome da receita…'}
              className="input-field"
            />
          </div>

          {/* Lista de opções */}
          <div className="max-h-44 overflow-y-auto rounded-xl border border-accent-primary/12 bg-input divide-y divide-accent-primary/8">
            {loading ? (
              <p className="text-secondary text-sm px-4 py-3">Carregando…</p>
            ) : opcoes.length === 0 ? (
              <p className="text-secondary/60 text-sm px-4 py-3">Nenhum resultado</p>
            ) : (
              opcoes.slice(0, 80).map(op => {
                const isSelected = op.id === selectedId
                const naLista = jaNaLista(tipo, op.id)
                const sub = 'unidade_uso' in op ? op.categoria ?? op.unidade_uso : op.rendimento_unidade
                return (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => { setSelectedId(op.id); setErro(null) }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between gap-2 ${
                      isSelected ? 'bg-accent-primary/15 text-primary' : 'text-secondary hover:bg-input hover:text-primary'
                    }`}
                  >
                    <span className="truncate flex items-center gap-2">
                      {op.nome}
                      {naLista && <span className="text-[10px] text-accent-primary/70 shrink-0">✓ na lista</span>}
                    </span>
                    <span className={`text-xs shrink-0 ${isSelected ? 'text-accent-primary' : 'text-secondary/60'}`}>{sub}</span>
                  </button>
                )
              })
            )}
          </div>

          {/* Quantidade + adicionar */}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="field-label">Quantidade{unidadeDisplay ? ` em ${unidadeDisplay}` : ''}</label>
              <input
                type="text"
                inputMode="decimal"
                value={quantidade}
                onChange={e => setQuantidade(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarNaLista() } }}
                placeholder={unidadeDisplay === 'g' ? '250' : unidadeDisplay === 'ml' ? '100' : '1'}
                className="input-field"
                disabled={!selectedId}
              />
            </div>
            <button
              type="button"
              onClick={adicionarNaLista}
              disabled={!selectedId}
              className="btn-ghost border-accent-primary/25 text-accent-primary hover:text-accent-primary hover:border-accent-primary/40 hover:bg-accent-primary/6 px-4 h-[42px] disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <Plus size={15} />
              Adicionar à lista
            </button>
          </div>
          {!selectedId && <p className="text-secondary/50 text-xs -mt-2">Selecione um item acima primeiro</p>}

          {/* Lista montada */}
          {staged.length > 0 && (
            <div className="rounded-xl border border-accent-primary/12 bg-input/40 divide-y divide-accent-primary/8">
              <div className="px-4 py-2 text-[11px] uppercase tracking-wider text-secondary font-semibold">
                Itens a adicionar ({totalItens})
              </div>
              {staged.map(s => (
                <div key={s.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-primary text-sm truncate">{s.nome}</p>
                    <p className="text-secondary text-xs">
                      {s.quantidadeStr} {s.unidade}
                      {s.tipo === 'sub_receita' && <span className="ml-1.5 text-blue-400 italic">sub-receita</span>}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removerDaLista(s.key)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary/50 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                    aria-label={`Remover ${s.nome}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {erro && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-400 text-sm">{erro}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-accent-primary/10 shrink-0">
          <button type="button" onClick={onClose} className="btn-ghost flex-1" disabled={saving}>Cancelar</button>
          <button type="button" onClick={salvar} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Salvando…' : totalItens > 0 ? `Salvar ${totalItens} ite${totalItens > 1 ? 'ns' : 'm'}` : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal de EDIÇÃO de 1 item (mantém o fluxo clássico) ───────────────────────

function ItemEditModal({ receitaId, item, onClose }: { receitaId: string; item: ReceitaItemComCusto; onClose: () => void }) {
  const [state, action, pending] = useActionState<ActionResult | undefined, FormData>(updateItem, undefined)
  const { insumos, subReceitas, loading } = useOpcoes(receitaId)

  const [tipo, setTipo] = useState<TipoItem>(item.sub_receita_id ? 'sub_receita' : 'insumo')
  const [busca, setBusca] = useState('')
  const [selectedId, setSelectedId] = useState<string>(item.insumo_id ?? item.sub_receita_id ?? '')

  useEffect(() => {
    if (state?.success) onClose()
  }, [state?.success, onClose])

  function handleTipoChange(t: TipoItem) {
    setTipo(t); setBusca(''); setSelectedId('')
  }

  const termNorm = normalizeSearch(busca)
  const opcoes = tipo === 'insumo'
    ? insumos.filter(i => !termNorm || normalizeSearch(i.nome).includes(termNorm) || normalizeSearch(i.categoria ?? '').includes(termNorm))
    : subReceitas.filter(s => !termNorm || normalizeSearch(s.nome).includes(termNorm))

  const selected = tipo === 'insumo'
    ? insumos.find(i => i.id === selectedId)
    : subReceitas.find(s => s.id === selectedId)
  const unidadeDisplay = unidadeDe(selected)

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-2xl border border-accent-primary/12 shadow-[0_8px_40px_rgba(0,0,0,0.12)] w-full max-w-lg max-h-[90vh] flex flex-col">

        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-accent-primary/10 shrink-0">
          <div>
            <h2 className="font-playfair text-primary text-[22px] font-bold leading-tight">Editar Item</h2>
            <p className="text-secondary text-xs mt-0.5">{item.nome_display}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:text-accent-primary hover:bg-accent-primary/10 transition-all" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          <form action={action} className="space-y-5">
            <input type="hidden" name="receita_id" value={receitaId} />
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name={tipo === 'insumo' ? 'insumo_id' : 'sub_receita_id'} value={selectedId} />

            <SectionLabel icon={ShoppingCart}>Tipo de item</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {(['insumo', 'sub_receita'] as TipoItem[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTipoChange(t)}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                    tipo === t
                      ? 'bg-accent-primary/15 border-accent-primary/30 text-accent-primary'
                      : 'bg-transparent border-accent-primary/15 text-secondary hover:text-primary hover:border-accent-primary/25'
                  }`}
                >
                  {t === 'insumo' ? 'Insumo' : 'Sub-receita'}
                </button>
              ))}
            </div>

            <div>
              <label className="field-label">{tipo === 'insumo' ? 'Buscar insumo' : 'Buscar sub-receita'}</label>
              <input
                type="text"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder={tipo === 'insumo' ? 'Digite o nome ou categoria…' : 'Digite o nome da receita…'}
                className="input-field"
              />
            </div>

            <div className="max-h-52 overflow-y-auto rounded-xl border border-accent-primary/12 bg-input divide-y divide-accent-primary/8">
              {loading ? (
                <p className="text-secondary text-sm px-4 py-3">Carregando…</p>
              ) : opcoes.length === 0 ? (
                <p className="text-secondary/60 text-sm px-4 py-3">Nenhum resultado</p>
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
                        isSelected ? 'bg-accent-primary/15 text-primary' : 'text-secondary hover:bg-input hover:text-primary'
                      }`}
                    >
                      <span className="truncate">{op.nome}</span>
                      <span className={`text-xs shrink-0 ${isSelected ? 'text-accent-primary' : 'text-secondary/60'}`}>{sub}</span>
                    </button>
                  )
                })
              )}
            </div>

            {selected && (
              <div className="rounded-xl border border-accent-primary/20 bg-accent-primary/6 px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-primary text-sm font-medium truncate">{selected.nome}</p>
                  <p className="text-secondary text-xs mt-0.5">
                    unidade: <span className="text-accent-primary">{unidadeDisplay}</span>
                  </p>
                </div>
              </div>
            )}

            <div>
              <label className="field-label">Quantidade{unidadeDisplay ? ` em ${unidadeDisplay}` : ''}</label>
              <input
                type="text"
                inputMode="decimal"
                name="quantidade"
                required
                defaultValue={item.quantidade.toString().replace('.', ',')}
                placeholder={unidadeDisplay === 'g' ? '250' : unidadeDisplay === 'ml' ? '100' : '1'}
                className="input-field"
                disabled={!selectedId}
              />
              {!selectedId && <p className="text-secondary/50 text-xs mt-1">Selecione um item acima primeiro</p>}
            </div>

            {state?.error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-400 text-sm">{state.error}</div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancelar</button>
              <button type="submit" disabled={pending || !selectedId} className="btn-primary flex-1">
                {pending ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
