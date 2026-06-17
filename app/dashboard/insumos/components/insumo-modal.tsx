'use client'

import { useActionState, useEffect, useState } from 'react'
import { X, ShoppingCart, ChevronDown, Clock, Pencil } from 'lucide-react'
import {
  createInsumo,
  updateInsumo,
  addPreco,
  getPrecoHistorico,
} from '../actions'
import { parseDecimalBR, formatBRL, formatCustoUso } from '@/lib/format'
import { SectionLabel } from '@/app/components/ui/section-label'
import type { ActionResult, InsumoComCusto, InsumoPreco } from '../types'

// ─── Sub-componentes ──────────────────────────────────────────────────────────

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

interface PrecoPreviewProps {
  preco: string
  qtd: string
  unidade: string
}

function PrecoPreview({ preco, qtd, unidade }: PrecoPreviewProps) {
  const p = parseDecimalBR(preco)
  const q = parseDecimalBR(qtd)
  if (!preco || !qtd || isNaN(p) || isNaN(q) || q <= 0 || p <= 0) return null

  const custo = p / q
  const decimals = custo < 0.1 ? 4 : 2
  const [intPart, decPart] = custo
    .toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    .split(',')

  return (
    <div className="rounded-xl border border-croissant/25 bg-croissant/[0.07] px-5 py-4">
      <p className="field-label mb-2">Custo por {unidade}</p>
      <div className="flex items-baseline gap-0.5">
        <span className="text-demerara text-base font-outfit">R$&nbsp;</span>
        <span className="font-playfair text-croissant text-[36px] font-bold leading-none">
          {intPart}
        </span>
        <span className="font-playfair text-croissant text-[22px] font-bold leading-none">
          ,{decPart}
        </span>
        <span className="text-demerara text-sm font-outfit ml-0.5">/{unidade}</span>
      </div>
    </div>
  )
}

function ErrorBox({ message }: { message?: string }) {
  if (!message) return null
  return (
    <div className="rounded-xl border border-red-400/20 bg-red-400/8 px-4 py-3 text-red-400 text-sm">
      {message}
    </div>
  )
}

interface SelectFieldProps {
  name: string
  label: string
  value?: string
  defaultValue?: string
  onChange?: (v: string) => void
  children: React.ReactNode
}

function SelectField({ name, label, value, defaultValue, onChange, children }: SelectFieldProps) {
  const controlled = value !== undefined && onChange !== undefined
  return (
    <div>
      <label className="field-label">{label}</label>
      <div className="relative">
        <select
          name={name}
          {...(controlled ? { value, onChange: (e) => onChange(e.target.value) } : { defaultValue })}
          className="input-field appearance-none pr-10"
        >
          {children}
        </select>
        <ChevronDown
          size={15}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-demerara/50 pointer-events-none"
        />
      </div>
    </div>
  )
}

interface PrecoCamposProps {
  unidade_uso: string
  precoCompra: string
  setPrecoCompra: (v: string) => void
  qtdUso: string
  setQtdUso: (v: string) => void
  unidadeCompraDefault?: string
}

function PrecoCampos({
  unidade_uso,
  precoCompra,
  setPrecoCompra,
  qtdUso,
  setQtdUso,
  unidadeCompraDefault = '',
}: PrecoCamposProps) {
  const qtdPlaceholder =
    unidade_uso === 'g' ? '25000' : unidade_uso === 'ml' ? '1000' : '24'

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
        <DecimalInput
          name="preco_compra"
          label="Preço de compra (R$)"
          placeholder="0,00"
          value={precoCompra}
          onChange={setPrecoCompra}
        />
        <DecimalInput
          name="qtd_uso_por_compra"
          label={`Qtd em ${unidade_uso}`}
          placeholder={qtdPlaceholder}
          value={qtdUso}
          onChange={setQtdUso}
        />
      </div>

      <PrecoPreview preco={precoCompra} qtd={qtdUso} unidade={unidade_uso} />
    </div>
  )
}

// ─── Modal principal ──────────────────────────────────────────────────────────

interface Props {
  insumo: InsumoComCusto | null
  categorias: string[]
  onClose: () => void
}

const UNIDADES = [
  { value: 'g', label: 'g — grama' },
  { value: 'ml', label: 'ml — mililitro' },
  { value: 'un', label: 'un — unidade' },
]

export function InsumoModal({ insumo, categorias, onClose }: Props) {
  const isEdit = !!insumo

  const [createState, createAction, createPending] = useActionState<
    ActionResult | undefined,
    FormData
  >(createInsumo, undefined)

  const [editState, editAction, editPending] = useActionState<
    ActionResult | undefined,
    FormData
  >(updateInsumo, undefined)

  const [precoState, precoAction, precoPending] = useActionState<
    ActionResult | undefined,
    FormData
  >(addPreco, undefined)

  const [precoCompra, setPrecoCompra] = useState('')
  const [qtdUso, setQtdUso] = useState('')
  const [unidadeUso, setUnidadeUso] = useState(insumo?.unidade_uso ?? 'g')
  const [historico, setHistorico] = useState<InsumoPreco[]>([])

  useEffect(() => {
    if (insumo) {
      getPrecoHistorico(insumo.id).then(setHistorico)
    }
  }, [insumo])

  useEffect(() => {
    if (createState?.success || editState?.success || precoState?.success) {
      onClose()
    }
  }, [createState?.success, editState?.success, precoState?.success, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="relative bg-[#1a1a22] rounded-2xl border border-white/10 shadow-[0_24px_64px_rgba(0,0,0,0.6)] w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/[0.07] shrink-0">
          <div>
            <h2 className="font-playfair text-creme text-[22px] font-bold leading-tight">
              {isEdit ? insumo.nome : 'Novo Insumo'}
            </h2>
            {isEdit && (
              <p className="text-demerara text-xs mt-0.5">editar cadastro</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-demerara/50 hover:text-creme hover:bg-white/8 transition-all"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Corpo rolável */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-7">

          {/* ══ CRIAR ══════════════════════════════════════════════════════ */}
          {!isEdit && (
            <form action={createAction} className="space-y-6">
              {/* Seção: dados */}
              <div className="space-y-4">
                <SectionLabel icon={Pencil}>Dados do insumo</SectionLabel>

                <div>
                  <label className="field-label">Nome</label>
                  <input
                    type="text"
                    name="nome"
                    required
                    placeholder="Ex: Farinha de trigo especial"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="field-label">Categoria</label>
                  <input
                    type="text"
                    name="categoria"
                    required
                    placeholder="Farinhas, Gorduras, Laticínios…"
                    list="categorias-create"
                    className="input-field"
                  />
                  <datalist id="categorias-create">
                    {categorias.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                <SelectField
                  name="unidade_uso"
                  label="Unidade de uso"
                  value={unidadeUso}
                  onChange={setUnidadeUso}
                >
                  {UNIDADES.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </SelectField>
              </div>

              {/* Seção: preço */}
              <div className="space-y-4">
                <SectionLabel icon={ShoppingCart}>Preço de compra</SectionLabel>
                <PrecoCampos
                  unidade_uso={unidadeUso}
                  precoCompra={precoCompra}
                  setPrecoCompra={setPrecoCompra}
                  qtdUso={qtdUso}
                  setQtdUso={setQtdUso}
                />
              </div>

              <ErrorBox message={createState?.error} />

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={onClose} className="btn-ghost flex-1">
                  Cancelar
                </button>
                <button type="submit" disabled={createPending} className="btn-primary flex-1">
                  {createPending ? 'Salvando…' : 'Salvar Insumo'}
                </button>
              </div>
            </form>
          )}

          {/* ══ EDITAR ═════════════════════════════════════════════════════ */}
          {isEdit && (
            <>
              {/* Dados */}
              <form action={editAction} className="space-y-4">
                <input type="hidden" name="id" value={insumo.id} />

                <SectionLabel icon={Pencil}>Dados do insumo</SectionLabel>

                <div>
                  <label className="field-label">Nome</label>
                  <input
                    type="text"
                    name="nome"
                    required
                    defaultValue={insumo.nome}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="field-label">Categoria</label>
                  <input
                    type="text"
                    name="categoria"
                    defaultValue={insumo.categoria ?? ''}
                    list="categorias-edit"
                    className="input-field"
                  />
                  <datalist id="categorias-edit">
                    {categorias.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                <SelectField
                  name="unidade_uso"
                  label="Unidade de uso"
                  defaultValue={insumo.unidade_uso}
                >
                  {UNIDADES.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </SelectField>

                <ErrorBox message={editState?.error} />

                <div className="flex gap-3">
                  <button type="button" onClick={onClose} className="btn-ghost flex-1">
                    Cancelar
                  </button>
                  <button type="submit" disabled={editPending} className="btn-primary flex-1">
                    {editPending ? 'Salvando…' : 'Salvar Alterações'}
                  </button>
                </div>
              </form>

              {/* Atualizar preço */}
              <form action={precoAction} className="space-y-4">
                <input type="hidden" name="insumo_id" value={insumo.id} />

                <SectionLabel icon={ShoppingCart}>Atualizar preço</SectionLabel>

                <PrecoCampos
                  unidade_uso={insumo.unidade_uso}
                  precoCompra={precoCompra}
                  setPrecoCompra={setPrecoCompra}
                  qtdUso={qtdUso}
                  setQtdUso={setQtdUso}
                  unidadeCompraDefault={insumo.custo?.unidade_compra ?? ''}
                />

                <ErrorBox message={precoState?.error} />

                <button
                  type="submit"
                  disabled={precoPending}
                  className="w-full btn-ghost border-croissant/30 text-croissant hover:text-croissant hover:border-croissant/50 hover:bg-croissant/8"
                >
                  {precoPending ? 'Registrando…' : 'Registrar Novo Preço'}
                </button>
              </form>

              {/* Histórico */}
              {historico.length > 0 && (
                <div className="space-y-3">
                  <SectionLabel icon={Clock}>Últimos preços</SectionLabel>
                  <div className="space-y-2">
                    {historico.map((p, idx) => {
                      const custo = p.preco_compra / p.qtd_uso_por_compra
                      const date = new Date(p.vigente_desde + 'T12:00:00').toLocaleDateString('pt-BR')
                      return (
                        <div
                          key={p.id}
                          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm ${
                            idx === 0
                              ? 'bg-croissant/10 border border-croissant/20'
                              : 'bg-white/[0.03] border border-white/[0.06]'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className={`text-xs font-medium ${idx === 0 ? 'text-creme' : 'text-demerara'}`}>
                              {date}
                            </p>
                            <p className="text-demerara text-xs truncate mt-0.5">
                              {p.unidade_compra} — R$ {formatBRL(p.preco_compra)}
                            </p>
                          </div>
                          <p className={`font-playfair text-base font-semibold shrink-0 ${
                            idx === 0 ? 'text-croissant' : 'text-demerara/70'
                          }`}>
                            {formatCustoUso(custo, insumo.unidade_uso)}
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
