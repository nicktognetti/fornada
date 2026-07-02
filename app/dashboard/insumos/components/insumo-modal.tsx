'use client'

import { useActionState, useEffect, useState } from 'react'
import { X, ShoppingCart, Clock, Pencil } from 'lucide-react'
import {
  createInsumo,
  updateInsumo,
  addPreco,
  getPrecoHistorico,
} from '../actions'
import { parseDecimalBR, formatBRL, formatCustoGrande } from '@/lib/format'
import { SectionLabel } from '@/app/components/ui/section-label'
import { UnidadeMedidaSelector } from '@/app/components/ui/unidade-medida-selector'
import type { ActionResult, InsumoComCusto, InsumoPreco } from '../types'

interface DecimalInputProps {
  name: string
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  required?: boolean
}

function DecimalInput({ name, label, placeholder, value, onChange, required = true }: DecimalInputProps) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input
        type="text"
        inputMode="decimal"
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="input-field"
      />
    </div>
  )
}

function PrecoPreview({ preco, qtd, unidade }: { preco: string; qtd: string; unidade: string }) {
  const p = parseDecimalBR(preco)
  const q = parseDecimalBR(qtd)
  if (!preco || !qtd || isNaN(p) || isNaN(q) || q <= 0 || p <= 0) return null

  const custo = p / q
  const decimals = custo < 0.1 ? 4 : 2
  const [intPart, decPart] = custo
    .toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    .split(',')

  return (
    <div className="rounded-xl border border-accent-primary/20 bg-accent-primary/6 px-5 py-4">
      <p className="field-label mb-2">Custo por {unidade}</p>
      <div className="flex items-baseline gap-0.5">
        <span className="text-secondary text-base font-outfit">R$&nbsp;</span>
        <span className="font-playfair text-accent-primary text-[36px] font-bold leading-none">{intPart}</span>
        <span className="font-playfair text-accent-primary text-[22px] font-bold leading-none">,{decPart}</span>
        <span className="text-secondary text-sm font-outfit ml-0.5">/{unidade}</span>
      </div>
    </div>
  )
}

function ErrorBox({ message }: { message?: string }) {
  if (!message) return null
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-400 text-sm">
      {message}
    </div>
  )
}

function PrecoCampos({ unidade_uso, precoCompra, setPrecoCompra, qtdUso, setQtdUso, unidadeCompraDefault = '' }: {
  unidade_uso: string; precoCompra: string; setPrecoCompra: (v: string) => void
  qtdUso: string; setQtdUso: (v: string) => void; unidadeCompraDefault?: string
}) {
  const qtdPlaceholder = unidade_uso === 'g' ? '25000' : unidade_uso === 'ml' ? '1000' : '24'
  return (
    <div className="space-y-4">
      <div>
        <label className="field-label">Como é comprado</label>
        <input
          type="text"
          name="unidade_compra"
          required
          defaultValue={unidadeCompraDefault}
          placeholder="Ex: fardo 25kg, caixa c/24, kg…"
          className="input-field"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <DecimalInput name="preco_compra" label="Preço de compra (R$)" placeholder="0,00" value={precoCompra} onChange={setPrecoCompra} />
        <DecimalInput name="qtd_uso_por_compra" label={`Qtd em ${unidade_uso}`} placeholder={qtdPlaceholder} value={qtdUso} onChange={setQtdUso} />
      </div>
      <PrecoPreview preco={precoCompra} qtd={qtdUso} unidade={unidade_uso} />
    </div>
  )
}

interface Props {
  insumo: InsumoComCusto | null
  categorias: string[]
  onClose: () => void
}

const UNIDADES_INSUMO = [
  { value: 'g',  label: 'g',  nome: 'grama' },
  { value: 'ml', label: 'ml', nome: 'mililitro' },
  { value: 'un', label: 'un', nome: 'unidade' },
]

export function InsumoModal({ insumo, categorias, onClose }: Props) {
  const isEdit = !!insumo

  const [createState, createAction, createPending] = useActionState<ActionResult | undefined, FormData>(createInsumo, undefined)
  const [editState, editAction, editPending] = useActionState<ActionResult | undefined, FormData>(updateInsumo, undefined)
  const [precoState, precoAction, precoPending] = useActionState<ActionResult | undefined, FormData>(addPreco, undefined)

  const [precoCompra, setPrecoCompra] = useState('')
  const [qtdUso, setQtdUso] = useState('')
  const [unidadeUso, setUnidadeUso] = useState(insumo?.unidade_uso ?? 'g')
  const [historico, setHistorico] = useState<InsumoPreco[]>([])

  useEffect(() => {
    if (insumo) getPrecoHistorico(insumo.id).then(setHistorico)
  }, [insumo])

  useEffect(() => {
    if (createState?.success || editState?.success || precoState?.success) onClose()
  }, [createState?.success, editState?.success, precoState?.success, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-2xl border border-accent-primary/12 shadow-[0_8px_40px_rgba(0,0,0,0.12)] w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-accent-primary/10 shrink-0">
          <div>
            <h2 className="font-playfair text-primary text-[22px] font-bold leading-tight">
              {isEdit ? insumo.nome : 'Novo Insumo'}
            </h2>
            {isEdit && <p className="text-secondary text-xs mt-0.5">editar cadastro</p>}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:text-accent-primary hover:bg-accent-primary/10 transition-all" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        {/* Corpo */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-7">

          {/* ── CRIAR ── */}
          {!isEdit && (
            <form action={createAction} className="space-y-6">
              <div className="space-y-4">
                <SectionLabel icon={Pencil}>Dados do insumo</SectionLabel>
                <div>
                  <label className="field-label">Nome</label>
                  <input type="text" name="nome" required placeholder="Ex: Farinha de trigo especial" className="input-field" />
                </div>
                <div>
                  <label className="field-label">Categoria</label>
                  <input type="text" name="categoria" required placeholder="Farinhas, Gorduras, Laticínios…" list="categorias-create" className="input-field" />
                  <datalist id="categorias-create">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
                </div>
                <div>
                  <label className="field-label">Unidade de uso</label>
                  <UnidadeMedidaSelector
                    name="unidade_uso"
                    options={UNIDADES_INSUMO}
                    value={unidadeUso}
                    onChange={setUnidadeUso}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <SectionLabel icon={ShoppingCart}>Preço de compra</SectionLabel>
                <PrecoCampos
                  unidade_uso={unidadeUso}
                  precoCompra={precoCompra} setPrecoCompra={setPrecoCompra}
                  qtdUso={qtdUso} setQtdUso={setQtdUso}
                />
              </div>

              <ErrorBox message={createState?.error} />

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancelar</button>
                <button type="submit" disabled={createPending} className="btn-primary flex-1">
                  {createPending ? 'Salvando…' : 'Salvar Insumo'}
                </button>
              </div>
            </form>
          )}

          {/* ── EDITAR ── */}
          {isEdit && (
            <>
              <form action={editAction} className="space-y-4">
                <input type="hidden" name="id" value={insumo.id} />
                <SectionLabel icon={Pencil}>Dados do insumo</SectionLabel>
                <div>
                  <label className="field-label">Nome</label>
                  <input type="text" name="nome" required defaultValue={insumo.nome} className="input-field" />
                </div>
                <div>
                  <label className="field-label">Categoria</label>
                  <input type="text" name="categoria" defaultValue={insumo.categoria ?? ''} list="categorias-edit" className="input-field" />
                  <datalist id="categorias-edit">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
                </div>
                <div>
                  <label className="field-label">Unidade de uso</label>
                  <UnidadeMedidaSelector
                    name="unidade_uso"
                    options={UNIDADES_INSUMO}
                    defaultValue={insumo.unidade_uso}
                  />
                </div>
                <ErrorBox message={editState?.error} />
                <div className="flex gap-3">
                  <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancelar</button>
                  <button type="submit" disabled={editPending} className="btn-primary flex-1">
                    {editPending ? 'Salvando…' : 'Salvar Alterações'}
                  </button>
                </div>
              </form>

              <form action={precoAction} className="space-y-4">
                <input type="hidden" name="insumo_id" value={insumo.id} />
                <SectionLabel icon={ShoppingCart}>Atualizar preço</SectionLabel>
                <PrecoCampos
                  unidade_uso={insumo.unidade_uso}
                  precoCompra={precoCompra} setPrecoCompra={setPrecoCompra}
                  qtdUso={qtdUso} setQtdUso={setQtdUso}
                  unidadeCompraDefault={insumo.custo?.unidade_compra ?? ''}
                />
                <ErrorBox message={precoState?.error} />
                <button type="submit" disabled={precoPending} className="w-full btn-ghost border-accent-primary/25 text-accent-primary hover:text-accent-primary hover:border-accent-primary/40 hover:bg-accent-primary/6">
                  {precoPending ? 'Registrando…' : 'Registrar Novo Preço'}
                </button>
              </form>

              {historico.length > 0 && (
                <div className="space-y-3">
                  <SectionLabel icon={Clock}>Últimos preços</SectionLabel>
                  <div className="space-y-2">
                    {historico.map((p, idx) => {
                      const custo = p.preco_compra / p.qtd_uso_por_compra
                      const date = new Date(p.vigente_desde + 'T12:00:00').toLocaleDateString('pt-BR')
                      return (
                        <div key={p.id} className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm ${
                          idx === 0
                            ? 'bg-accent-primary/10 border border-accent-primary/20'
                            : 'bg-input border border-accent-primary/8'
                        }`}>
                          <div className="min-w-0">
                            <p className={`text-xs font-medium ${idx === 0 ? 'text-primary' : 'text-secondary'}`}>{date}</p>
                            <p className="text-secondary text-xs truncate mt-0.5">{p.unidade_compra} — R$ {formatBRL(p.preco_compra)}</p>
                          </div>
                          <p className={`font-playfair text-base font-semibold shrink-0 ${idx === 0 ? 'text-accent-primary' : 'text-secondary'}`}>
                            {formatCustoGrande(custo, insumo.unidade_uso)}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
