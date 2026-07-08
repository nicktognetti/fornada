'use client'

import { useState, useEffect, useMemo } from 'react'
import { Copy, X, Check, Loader2 } from 'lucide-react'
import { useUnidade } from '@/app/context/unidade-context'
import { copiarEntreUnidades, getItensParaCopiar, type TipoCopia, type ItemCopiavel } from '@/app/actions/unidade'
import { usePermission } from '@/app/context/permissions-context'

const TIPOS: { value: TipoCopia; label: string; desc: string; selecionavel: boolean }[] = [
  { value: 'fichas',  label: 'Fichas Técnicas', desc: 'Escolha quais receitas copiar', selecionavel: true },
  { value: 'insumos', label: 'Insumos',         desc: 'Escolha quais insumos copiar', selecionavel: true },
  { value: 'precos',  label: 'Preços',           desc: 'Copia preços de venda (requer produtos de mesmo nome no destino)', selecionavel: false },
  { value: 'tudo',    label: 'Tudo',             desc: 'Insumos + Fichas + Preços (sem filtro)', selecionavel: false },
]

export function CopiarUnidadeModal() {
  const { unidades, unidadeAtual } = useUnidade()
  const { canWrite } = usePermission('cadastros')
  const [open, setOpen] = useState(false)
  const [paraUnidadeId, setParaUnidadeId] = useState('')
  const [tipo, setTipo] = useState<TipoCopia>('fichas')
  const [saving, setSaving] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  // Seleção de itens (para fichas/insumos)
  const [itens, setItens] = useState<ItemCopiavel[]>([])
  const [loadingItens, setLoadingItens] = useState(false)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [filtroGrupo, setFiltroGrupo] = useState('')

  const tipoConfig = TIPOS.find((t) => t.value === tipo)!
  const modoSelecao = tipoConfig.selecionavel

  // Carrega os itens quando muda tipo/destino (só para fichas/insumos)
  useEffect(() => {
    if (!open || !modoSelecao || !paraUnidadeId || !unidadeAtual) return
    let ativo = true
    // Reset síncrono ao mudar tipo/destino antes do fetch (estado de carregamento).
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoadingItens(true)
    setFiltroGrupo('')
    /* eslint-enable react-hooks/set-state-in-effect */
    getItensParaCopiar(unidadeAtual.id, paraUnidadeId, tipo as 'insumos' | 'fichas').then((res) => {
      if (!ativo) return
      const lista = res.itens ?? []
      setItens(lista)
      // pré-seleciona todos os que ainda não existem no destino
      setSelecionados(new Set(lista.filter((i) => !i.jaExiste).map((i) => i.id)))
      setLoadingItens(false)
    })
    return () => { ativo = false }
  }, [open, tipo, paraUnidadeId, modoSelecao, unidadeAtual])

  const grupos = useMemo(() => [...new Set(itens.map((i) => i.grupo))].sort(), [itens])
  const visiveis = useMemo(
    () => (filtroGrupo ? itens.filter((i) => i.grupo === filtroGrupo) : itens),
    [itens, filtroGrupo]
  )

  // Só mostra se há mais de 1 unidade e usuário tem permissão de escrita
  if (unidades.length <= 1 || !canWrite) return null
  if (!unidadeAtual) return null

  const destinos = unidades.filter((u) => u.id !== unidadeAtual.id)
  const selecionaveisVisiveis = visiveis.filter((i) => !i.jaExiste)

  function handleOpen() {
    setParaUnidadeId(destinos[0]?.id ?? '')
    setTipo('fichas')
    setResultado(null)
    setErro(null)
    setItens([])
    setSelecionados(new Set())
    setFiltroGrupo('')
    setOpen(true)
  }

  function toggle(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleTodosVisiveis() {
    const todosMarcados = selecionaveisVisiveis.every((i) => selecionados.has(i.id))
    setSelecionados((prev) => {
      const next = new Set(prev)
      for (const i of selecionaveisVisiveis) {
        if (todosMarcados) next.delete(i.id); else next.add(i.id)
      }
      return next
    })
  }

  async function handleConfirm() {
    if (!paraUnidadeId) return
    if (modoSelecao && selecionados.size === 0) { setErro('Selecione ao menos um item.'); return }
    setSaving(true); setErro(null); setResultado(null)
    try {
      const seletor = modoSelecao
        ? (tipo === 'insumos' ? { insumoIds: [...selecionados] } : { receitaIds: [...selecionados] })
        : undefined
      const res = await copiarEntreUnidades(unidadeAtual!.id, paraUnidadeId, tipo, seletor)
      if (res.error) { setErro(res.error); return }
      const c = res.copiados ?? {}
      const partes = [
        c.fichas != null  ? `${c.fichas} ficha${c.fichas !== 1 ? 's' : ''}` : null,
        c.insumos != null ? `${c.insumos} insumo${c.insumos !== 1 ? 's' : ''}` : null,
        c.precos != null  ? `${c.precos} preço${c.precos !== 1 ? 's' : ''}` : null,
      ].filter(Boolean)
      setResultado(partes.length > 0 ? `Copiado: ${partes.join(', ')}` : 'Nada novo para copiar (registros já existem no destino)')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        title={`Copiar de ${unidadeAtual.nome} para outra unidade`}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-secondary hover:text-ink-soft hover:bg-input/40 border border-subtle/50 transition-colors"
      >
        <Copy size={13} />
        Copiar
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !saving && setOpen(false)} />
          <div className="relative w-full max-w-md bg-surface border border-subtle rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <div className="flex items-center gap-2">
                <Copy size={16} className="text-accent-primary" />
                <h2 className="text-base font-semibold text-primary">Copiar para outra unidade</h2>
              </div>
              <button onClick={() => !saving && setOpen(false)} className="text-faint hover:text-secondary p-1"><X size={16} /></button>
            </div>

            <div className="px-6 overflow-y-auto space-y-5 pb-2">
              {/* De / Para */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="field-label">De</label>
                  <div className="input-field opacity-60 cursor-not-allowed select-none truncate">{unidadeAtual.nome}</div>
                </div>
                <div className="space-y-1">
                  <label className="field-label">Para</label>
                  <select value={paraUnidadeId} onChange={(e) => setParaUnidadeId(e.target.value)} className="input-field" disabled={saving}>
                    {destinos.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                </div>
              </div>

              {/* Tipo */}
              <div className="space-y-2">
                <label className="field-label">O que copiar</label>
                <div className="grid grid-cols-2 gap-2">
                  {TIPOS.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => { setTipo(t.value); setResultado(null); setErro(null) }}
                      disabled={saving}
                      className={`text-left p-2.5 rounded-xl border transition-colors ${
                        tipo === t.value ? 'border-accent-primary/40 bg-accent-primary/8' : 'border-subtle hover:bg-canvas/40'
                      }`}
                    >
                      <p className="text-sm font-medium text-primary">{t.label}</p>
                      <p className="text-[10px] text-faint leading-tight mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Seleção de itens (fichas/insumos) */}
              {modoSelecao && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="field-label">Itens ({selecionados.size} selecionado{selecionados.size !== 1 ? 's' : ''})</label>
                    {grupos.length > 1 && (
                      <select value={filtroGrupo} onChange={(e) => setFiltroGrupo(e.target.value)}
                        className="input-field text-xs py-1 px-2 w-auto max-w-[55%]" disabled={saving}>
                        <option value="">Todos os grupos</option>
                        {grupos.map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    )}
                  </div>

                  <div className="rounded-xl border border-subtle overflow-hidden">
                    <button onClick={toggleTodosVisiveis} disabled={saving || selecionaveisVisiveis.length === 0}
                      className="w-full flex items-center gap-2 px-3 py-2 border-b border-subtle bg-canvas text-xs text-secondary hover:text-primary disabled:opacity-40">
                      <Check size={12} />
                      {selecionaveisVisiveis.every((i) => selecionados.has(i.id)) && selecionaveisVisiveis.length > 0
                        ? 'Desmarcar todos' : 'Selecionar todos'}{filtroGrupo ? ` (${filtroGrupo})` : ''}
                    </button>

                    <div className="max-h-52 overflow-y-auto">
                      {loadingItens ? (
                        <div className="py-8 flex justify-center text-secondary"><Loader2 size={18} className="animate-spin" /></div>
                      ) : visiveis.length === 0 ? (
                        <div className="py-8 text-center text-faint text-sm">Nenhum item.</div>
                      ) : (
                        visiveis.map((i) => (
                          <label key={i.id}
                            className={`flex items-center gap-2.5 px-3 py-2 border-b border-subtle/50 last:border-0 ${
                              i.jaExiste ? 'opacity-50' : 'cursor-pointer hover:bg-canvas/40'
                            }`}>
                            <input type="checkbox" disabled={i.jaExiste || saving}
                              checked={selecionados.has(i.id)} onChange={() => toggle(i.id)}
                              className="accent-[var(--color-accent-primary)] shrink-0" />
                            <span className="flex-1 min-w-0">
                              <span className="text-sm text-primary truncate block">{i.nome}</span>
                              <span className="text-[10px] text-faint">{i.grupo}</span>
                            </span>
                            {i.jaExiste && <span className="text-[10px] text-success shrink-0">já existe</span>}
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Resultado / erro */}
              {resultado && (
                <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-success/10 border border-success/20 text-success text-sm">
                  <Check size={14} />{resultado}
                </div>
              )}
              {erro && (
                <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-danger/10 border border-danger/20 text-danger text-sm">
                  <X size={14} />{erro}
                </div>
              )}
            </div>

            {/* Ações */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-subtle mt-1">
              {!resultado ? (
                <>
                  <button onClick={() => setOpen(false)} disabled={saving}
                    className="px-4 py-2 rounded-xl text-sm text-secondary hover:text-primary hover:bg-input transition-colors disabled:opacity-50">
                    Cancelar
                  </button>
                  <button onClick={handleConfirm} disabled={saving || !paraUnidadeId || (modoSelecao && selecionados.size === 0)}
                    className="btn-primary px-5 py-2 disabled:opacity-50">
                    {saving ? 'Copiando…' : modoSelecao ? `Copiar ${selecionados.size}` : 'Confirmar cópia'}
                  </button>
                </>
              ) : (
                <button onClick={() => setOpen(false)} className="btn-primary px-5 py-2">Fechar</button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
