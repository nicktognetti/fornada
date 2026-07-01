'use client'

import { useState, useMemo } from 'react'
import { X, Package, ShoppingBag, Search, Check } from 'lucide-react'
import { createProdutoRevenda, createProdutoFabricado } from '@/app/actions/painel'
import { parseDecimalBR, formatBRL } from '@/lib/format'

export type FichaOpcao = {
  id: string
  nome: string
  custo_unitario: number | null
  rendimento_unidade: string | null
}

interface Props {
  unidades: { id: string; nome: string }[]
  receitas: FichaOpcao[]
  locais: string[]
  onClose: () => void
}

type Tipo = 'produzido' | 'revenda'

export function NovoProdutoModal({ unidades, receitas, locais, onClose }: Props) {
  const [tipo, setTipo] = useState<Tipo>('revenda')
  const [nome, setNome] = useState('')
  const [categoria, setCategoria] = useState('')
  const [unidadeId, setUnidadeId] = useState(unidades[0]?.id ?? '')
  const [custoCompra, setCustoCompra] = useState('')
  const [local, setLocal] = useState('')
  // Fabricado — ficha selecionada + busca
  const [receitaId, setReceitaId] = useState('')
  const [buscaFicha, setBuscaFicha] = useState('')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const fichaSel = receitas.find((r) => r.id === receitaId) ?? null

  const fichasFiltradas = useMemo(() => {
    const q = buscaFicha.trim().toLowerCase()
    const base = q ? receitas.filter((r) => r.nome.toLowerCase().includes(q)) : receitas
    return base.slice(0, 8)
  }, [buscaFicha, receitas])

  function escolherFicha(f: FichaOpcao) {
    setReceitaId(f.id)
    setBuscaFicha('')
    if (!nome.trim()) setNome(f.nome)
    setErro(null)
  }

  async function handleSalvar() {
    if (!nome.trim()) { setErro('Informe o nome do produto'); return }
    if (!unidadeId) { setErro('Selecione uma unidade'); return }

    if (tipo === 'revenda') {
      const custo = parseDecimalBR(custoCompra)
      if (!custo || custo <= 0) { setErro('Informe o custo de compra'); return }
      setSaving(true)
      const res = await createProdutoRevenda(nome.trim(), categoria || null, custo, unidadeId, local || null)
      setSaving(false)
      if (res.error) { setErro(res.error); return }
      onClose()
    } else {
      if (!receitaId) { setErro('Selecione a ficha técnica do produto'); return }
      setSaving(true)
      const res = await createProdutoFabricado(nome.trim(), categoria || null, receitaId, unidadeId, local || null)
      setSaving(false)
      if (res.error) { setErro(res.error); return }
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <div className="relative w-full max-w-md bg-surface border border-subtle rounded-2xl shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-primary">Novo Produto</h2>
          <button onClick={onClose} disabled={saving} className="text-faint hover:text-secondary p-1">
            <X size={16} />
          </button>
        </div>

        {/* Tipo */}
        <div className="grid grid-cols-2 gap-2">
          {/* Revenda */}
          <button
            onClick={() => { setTipo('revenda'); setErro(null) }}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-colors ${
              tipo === 'revenda'
                ? 'border-accent-primary/40 bg-accent-primary/8 text-accent-primary'
                : 'border-subtle text-secondary hover:border-subtle/60 hover:bg-canvas/40'
            }`}
          >
            <ShoppingBag size={20} />
            <span className="text-sm font-medium">Revenda</span>
            <span className="text-[10px] opacity-70">Comprado para vender</span>
          </button>

          {/* Fabricado */}
          <button
            onClick={() => { setTipo('produzido'); setErro(null) }}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-colors ${
              tipo === 'produzido'
                ? 'border-accent-primary/40 bg-accent-primary/8 text-accent-primary'
                : 'border-subtle text-secondary hover:border-subtle/60 hover:bg-canvas/40'
            }`}
          >
            <Package size={20} />
            <span className="text-sm font-medium">Fabricado</span>
            <span className="text-[10px] opacity-70">Tem ficha técnica</span>
          </button>
        </div>

        {/* Fabricado: seletor de ficha técnica */}
        {tipo === 'produzido' && (
          <div className="space-y-2">
            <label className="field-label">Ficha Técnica</label>

            {receitas.length === 0 && !fichaSel && (
              <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3 text-[12px] text-amber-400">
                Nenhuma ficha técnica disponível nesta loja. Crie a ficha em <strong>Receitas</strong> primeiro
                (ou todas as fichas já viraram produto).
              </div>
            )}

            {/* Ficha escolhida */}
            {fichaSel && (
              <div className="flex items-center justify-between gap-3 bg-accent-primary/8 border border-accent-primary/25 rounded-xl px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary truncate">{fichaSel.nome}</p>
                  <p className="text-[11px] text-secondary mt-0.5">
                    Custo {fichaSel.custo_unitario && fichaSel.custo_unitario > 0
                      ? <>R$ {formatBRL(fichaSel.custo_unitario)}<span className="text-faint"> / {fichaSel.rendimento_unidade ?? 'un'}</span></>
                      : <span className="text-amber-400">a definir (ficha sem custo)</span>}
                  </p>
                </div>
                <button
                  onClick={() => { setReceitaId(''); setBuscaFicha('') }}
                  className="text-xs text-secondary hover:text-primary shrink-0"
                  disabled={saving}
                >
                  trocar
                </button>
              </div>
            )}

            {/* Busca de ficha */}
            {!fichaSel && receitas.length > 0 && (
              <>
                <div className="relative">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary/50 pointer-events-none" />
                  <input
                    type="text"
                    value={buscaFicha}
                    onChange={(e) => setBuscaFicha(e.target.value)}
                    placeholder="Buscar ficha técnica…"
                    className="input-field pl-10"
                    disabled={saving}
                    autoFocus
                  />
                </div>
                <div className="max-h-52 overflow-y-auto rounded-xl border border-subtle divide-y divide-subtle/60">
                  {fichasFiltradas.length === 0 && (
                    <p className="text-secondary text-xs px-4 py-3">Nenhuma ficha encontrada.</p>
                  )}
                  {fichasFiltradas.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => escolherFicha(f)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-input transition-colors"
                    >
                      <span className="text-sm text-primary truncate">{f.nome}</span>
                      <span className="text-[11px] text-secondary shrink-0 tabular-nums">
                        {f.custo_unitario && f.custo_unitario > 0
                          ? `R$ ${formatBRL(f.custo_unitario)}/${f.rendimento_unidade ?? 'un'}`
                          : '—'}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Nome */}
        <div className="space-y-1">
          <label className="field-label">Nome</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={tipo === 'produzido' ? 'Ex: Bolo de Cenoura, Pão Francês' : 'Ex: Coca-Cola 600ml, Água mineral'}
            className="input-field"
            disabled={saving}
          />
          {tipo === 'produzido' && (
            <p className="text-[11px] text-faint">Nome de venda do produto (por padrão, o nome da ficha).</p>
          )}
        </div>

        {/* Categoria */}
        <div className="space-y-1">
          <label className="field-label">Categoria (opcional)</label>
          <input
            type="text"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            placeholder="Ex: Bolos, Pães, Bebidas"
            className="input-field"
            disabled={saving}
          />
        </div>

        {/* Unidade */}
        <div className="space-y-1">
          <label className="field-label">Loja / Unidade</label>
          <select
            value={unidadeId}
            onChange={(e) => setUnidadeId(e.target.value)}
            className="input-field"
            disabled={saving}
          >
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>{u.nome}</option>
            ))}
          </select>
        </div>

        {/* Local / setor de produção (opcional) */}
        <div className="space-y-1">
          <label className="field-label">Local de produção (opcional)</label>
          <select
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            className="input-field"
            disabled={saving}
          >
            <option value="">Sem local</option>
            {locais.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
          </select>
          <p className="text-[11px] text-faint">Setor que aparece na comanda da encomenda (Produção, Confeitaria…).</p>
        </div>

        {/* Custo (só revenda) */}
        {tipo === 'revenda' && (
          <div className="space-y-1">
            <label className="field-label">Custo de Compra (R$)</label>
            <input
              type="text"
              inputMode="decimal"
              value={custoCompra}
              onChange={(e) => setCustoCompra(e.target.value)}
              placeholder="0,00"
              className="input-field text-right tabular-nums"
              disabled={saving}
            />
          </div>
        )}

        {tipo === 'produzido' && (
          <p className="text-[11px] text-faint flex items-center gap-1.5">
            <Check size={13} className="text-success shrink-0" />
            O custo vem da ficha técnica. Defina o preço de venda depois, em <strong>Preços</strong>.
          </p>
        )}

        {erro && (
          <p className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 rounded-xl text-sm text-secondary hover:text-primary hover:bg-input transition-colors">
            Cancelar
          </button>
          <button onClick={handleSalvar} disabled={saving}
            className="btn-primary px-5 py-2 disabled:opacity-50">
            {saving ? 'Salvando…' : 'Criar Produto'}
          </button>
        </div>
      </div>
    </div>
  )
}
