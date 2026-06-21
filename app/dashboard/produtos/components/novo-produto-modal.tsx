'use client'

import { useState } from 'react'
import { X, Package, ShoppingBag } from 'lucide-react'
import { createProdutoRevenda } from '@/app/actions/painel'
import { parseDecimalBR } from '@/lib/format'

interface Props {
  unidades: { id: string; nome: string }[]
  receitas: { id: string; nome: string }[]
  onClose: () => void
}

type Tipo = 'produzido' | 'revenda'

export function NovoProdutoModal({ unidades, onClose }: Omit<Props, 'receitas'> & { receitas?: unknown }) {
  const [tipo, setTipo] = useState<Tipo>('revenda')
  const [nome, setNome] = useState('')
  const [categoria, setCategoria] = useState('')
  const [unidadeId, setUnidadeId] = useState(unidades[0]?.id ?? '')
  const [custoCompra, setCustoCompra] = useState('')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSalvar() {
    if (!nome.trim()) { setErro('Informe o nome do produto'); return }
    if (!unidadeId) { setErro('Selecione uma unidade'); return }
    if (tipo === 'revenda') {
      const custo = parseDecimalBR(custoCompra)
      if (!custo || custo <= 0) { setErro('Informe o custo de compra'); return }
      setSaving(true)
      const res = await createProdutoRevenda(nome.trim(), categoria || null, custo, unidadeId)
      setSaving(false)
      if (res.error) { setErro(res.error); return }
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <div className="relative w-full max-w-md bg-surface border border-subtle rounded-2xl shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-primary">Novo Produto</h2>
          <button onClick={onClose} disabled={saving} className="text-faint hover:text-secondary p-1">
            <X size={16} />
          </button>
        </div>

        {/* Tipo */}
        <div className="grid grid-cols-2 gap-2">
          {/* Revenda: disponível */}
          <button
            onClick={() => setTipo('revenda')}
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

          {/* Fabricado: desabilitado até createProdutoFabricado ser implementado */}
          <div
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-subtle/40 text-faint/50 cursor-not-allowed select-none relative"
            title="Em desenvolvimento — use Importar de Fichas"
          >
            <Package size={20} />
            <span className="text-sm font-medium">Fabricado</span>
            <span className="text-[10px]">Tem ficha técnica</span>
            <span className="absolute top-1.5 right-1.5 text-[8px] font-bold uppercase tracking-wide bg-amber-500/15 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
              Em breve
            </span>
          </div>
        </div>

        {tipo === 'produzido' && (
          <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3 text-[12px] text-amber-400">
            Para criar produtos fabricados, use o botão <strong>Importar de Fichas</strong> na página de produtos.
            Ele cria automaticamente um produto para cada ficha técnica existente.
          </div>
        )}

        {/* Nome */}
        <div className="space-y-1">
          <label className="field-label">Nome</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Coca-Cola 600ml, Água mineral"
            className="input-field"
            disabled={saving}
          />
        </div>

        {/* Categoria */}
        <div className="space-y-1">
          <label className="field-label">Categoria (opcional)</label>
          <input
            type="text"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            placeholder="Ex: Bebidas, Congelados, Frios"
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
          {tipo === 'revenda' && (
            <button onClick={handleSalvar} disabled={saving}
              className="btn-primary px-5 py-2 disabled:opacity-50">
              {saving ? 'Salvando…' : 'Criar Produto'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
