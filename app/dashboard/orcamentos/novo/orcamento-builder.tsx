'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Trash2, Loader2 } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { ProdutoPicker } from '@/app/components/ui/produto-picker'
import { parseDecimalBR, formatBRL } from '@/lib/format'
import { precoComAjuste, subtotalItem, totalPedido } from '@/lib/pedido-calc'
import { criarOrcamento, atualizarOrcamento, type ProdutoOrcamento } from '@/app/actions/orcamento'
import type { ClienteAutocomplete } from '@/app/actions/cliente'

interface Linha {
  key: number
  produto_id: string | null
  descricao: string
  base: number       // preço de venda de referência
  quantidade: string
  ajustePct: string  // % sobre o preço base (atalho)
  preco: string      // preço unitário efetivo
}

export type OrcamentoEdicao = {
  id: string
  cliente_nome: string
  cliente_contato: string | null
  validade_dias: number
  observacao: string | null
  itens: { produto_id: string | null; descricao: string; quantidade: number; preco_unitario: number }[]
}

export function OrcamentoBuilder({ produtos, clientes, edicao }: { produtos: ProdutoOrcamento[]; clientes: ClienteAutocomplete[]; edicao?: OrcamentoEdicao }) {
  const router = useRouter()
  const keyRef = useState(() => ({ n: 0 }))[0]
  const [cliente, setCliente] = useState(edicao?.cliente_nome ?? '')
  const [contato, setContato] = useState(edicao?.cliente_contato ?? '')
  const [validade, setValidade] = useState(String(edicao?.validade_dias ?? 7))
  const [obs, setObs] = useState(edicao?.observacao ?? '')
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    (edicao?.itens ?? []).map((it) => ({
      key: (keyRef.n += 1),
      produto_id: it.produto_id,
      descricao: it.descricao,
      base: it.preco_unitario,
      quantidade: String(it.quantidade),
      ajustePct: '',
      preco: it.preco_unitario > 0 ? it.preco_unitario.toFixed(2) : '',
    })),
  )
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function addProduto(p: ProdutoOrcamento) {
    setLinhas((prev) => {
      // Se o produto do catálogo já está na lista, incrementa a quantidade (não duplica).
      const idx = prev.findIndex((l) => l.produto_id === p.id)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = { ...copy[idx], quantidade: String((parseDecimalBR(copy[idx].quantidade) || 0) + 1) }
        return copy
      }
      return [...prev, {
        key: (keyRef.n += 1),
        produto_id: p.id,
        descricao: p.nome,
        base: p.preco_base,
        quantidade: '1',
        ajustePct: '',
        preco: p.preco_base > 0 ? p.preco_base.toFixed(2) : '',
      }]
    })
    setErro(null)
  }

  function addAvulso() {
    setLinhas((prev) => [...prev, {
      key: (keyRef.n += 1), produto_id: null, descricao: '', base: 0,
      quantidade: '1', ajustePct: '', preco: '',
    }])
    setErro(null)
  }

  function upd(key: number, campo: keyof Linha, valor: string) {
    setLinhas((prev) => prev.map((l) => {
      if (l.key !== key) return l
      const next = { ...l, [campo]: valor }
      // Ao mexer no %, recalcula o preço a partir da base
      if (campo === 'ajustePct') {
        const pct = parseDecimalBR(valor)
        if (l.base > 0 && !isNaN(pct)) next.preco = precoComAjuste(l.base, pct).toFixed(2)
      }
      return next
    }))
    setErro(null)
  }

  function remover(key: number) {
    setLinhas((prev) => prev.filter((l) => l.key !== key))
  }

  const total = useMemo(
    () => totalPedido(linhas.map((l) => ({ quantidade: parseDecimalBR(l.quantidade), precoUnitario: parseDecimalBR(l.preco) }))),
    [linhas],
  )

  async function salvar() {
    if (!cliente.trim()) { setErro('Informe o nome do cliente'); return }
    if (linhas.length === 0) { setErro('Adicione ao menos um item'); return }
    setSaving(true); setErro(null)
    const itens = linhas.map((l) => ({
      produto_id: l.produto_id,
      descricao: l.descricao,
      quantidade: parseDecimalBR(l.quantidade),
      preco_unitario: parseDecimalBR(l.preco),
    }))
    const payload = { cliente_nome: cliente, cliente_contato: contato, validade_dias: parseInt(validade) || 7, observacao: obs }
    const res = edicao
      ? await atualizarOrcamento(edicao.id, payload, itens)
      : await criarOrcamento(payload, itens)
    setSaving(false)
    if (res.error || !res.data) { setErro(res.error ?? 'Erro ao salvar'); return }
    router.push(`/dashboard/orcamentos/${res.data.id}`)
  }

  const INPUT = 'input-field text-sm'

  return (
    <div className="max-w-3xl space-y-6">
      <PageTitle icon={FileText} subtitle="Monte um orçamento e ajuste preços por item">{edicao ? 'Editar orçamento' : 'Novo orçamento'}</PageTitle>

      {/* Dados do cliente */}
      <div className="card-surface p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1 sm:col-span-2">
          <label className="field-label">Cliente *</label>
          <input list="clientes-list" autoComplete="off" value={cliente} placeholder="Nome do cliente" className={INPUT}
            onChange={(e) => { const v = e.target.value; setCliente(v); const c = clientes.find((x) => x.nome === v); if (c?.telefone) setContato(c.telefone) }} />
          <datalist id="clientes-list">{clientes.map((c) => <option key={c.nome} value={c.nome} />)}</datalist>
        </div>
        <div className="space-y-1">
          <label className="field-label">Contato</label>
          <input value={contato} onChange={(e) => setContato(e.target.value)} className={INPUT} placeholder="Telefone / e-mail" />
        </div>
        <div className="space-y-1">
          <label className="field-label">Validade (dias)</label>
          <input value={validade} inputMode="numeric" onChange={(e) => setValidade(e.target.value.replace(/\D/g, ''))} className={INPUT} placeholder="7" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="field-label">Observação</label>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} className={`${INPUT} min-h-[60px]`} placeholder="Condições, prazo de entrega…" />
        </div>
      </div>

      {/* Adicionar produto */}
      <ProdutoPicker produtos={produtos} onPick={addProduto} onAvulso={addAvulso} />

      {/* Itens */}
      {linhas.length > 0 && (
        <div className="card-surface overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_70px_90px_70px_100px_90px_32px] gap-2 px-4 py-2.5 border-b border-subtle bg-canvas text-[10px] font-semibold uppercase tracking-wider text-faint">
            <span>Item</span><span className="text-right">Qtd</span><span className="text-right">Base</span>
            <span className="text-right">%</span><span className="text-right">Preço un.</span><span className="text-right">Subtotal</span><span />
          </div>
          {linhas.map((l) => {
            const isAvulso = l.produto_id === null
            const sub = subtotalItem(parseDecimalBR(l.quantidade), parseDecimalBR(l.preco))
            return (
              <div key={l.key} className="grid grid-cols-2 md:grid-cols-[1fr_70px_90px_70px_100px_90px_32px] gap-2 items-center px-4 py-2.5 border-b border-subtle last:border-0">
                {isAvulso ? (
                  <input value={l.descricao} onChange={(e) => upd(l.key, 'descricao', e.target.value)} placeholder="Descrição do item avulso" className="input-field text-sm py-1.5 px-2 col-span-2 md:col-span-1" />
                ) : (
                  <span className="col-span-2 md:col-span-1 text-sm text-primary px-2 py-1.5 truncate" title={l.descricao}>{l.descricao}</span>
                )}
                <input value={l.quantidade} inputMode="decimal" onChange={(e) => upd(l.key, 'quantidade', e.target.value)} className="input-field text-sm py-1.5 px-2 text-right tabular-nums" placeholder="1" />
                <span className="text-right text-xs text-faint tabular-nums hidden md:block">{l.base > 0 ? `R$ ${formatBRL(l.base)}` : '—'}</span>
                <input value={l.ajustePct} inputMode="decimal" disabled={isAvulso} onChange={(e) => upd(l.key, 'ajustePct', e.target.value)} className={`input-field text-sm py-1.5 px-2 text-right tabular-nums ${isAvulso ? 'opacity-40 cursor-not-allowed' : ''}`} placeholder="%" title={isAvulso ? 'Ajuste % vale só para itens do catálogo' : '% sobre o preço base'} />
                {isAvulso ? (
                  <input value={l.preco} inputMode="decimal" onChange={(e) => upd(l.key, 'preco', e.target.value)} className="input-field text-sm py-1.5 px-2 text-right tabular-nums" placeholder="0,00" />
                ) : (
                  <span className="text-right text-sm text-primary tabular-nums px-2 py-1.5" title="Preço do catálogo — ajuste pela %">{l.preco ? `R$ ${formatBRL(parseDecimalBR(l.preco))}` : '—'}</span>
                )}
                <span className="text-right text-sm font-medium text-primary tabular-nums">R$ {formatBRL(sub)}</span>
                <button onClick={() => remover(l.key)} className="w-7 h-7 rounded-lg flex items-center justify-center text-secondary/40 hover:text-red-400 hover:bg-red-500/10 transition-all justify-self-end" aria-label="Remover item">
                  <Trash2 size={13} />
                </button>
              </div>
            )
          })}
          <div className="flex items-center justify-between px-4 py-3 bg-input">
            <span className="text-sm text-secondary">Total do orçamento</span>
            <span className="font-playfair text-accent-primary text-2xl font-bold tabular-nums">R$ {formatBRL(total)}</span>
          </div>
        </div>
      )}

      {erro && <p className="text-sm text-danger bg-danger-tint rounded-lg px-3 py-2">{erro}</p>}

      <div className="flex justify-end gap-3">
        <button onClick={() => router.push(edicao ? `/dashboard/orcamentos/${edicao.id}` : '/dashboard/orcamentos')} className="px-5 py-2.5 rounded-lg border border-subtle text-ink-soft hover:bg-input text-sm">Cancelar</button>
        <button onClick={salvar} disabled={saving || linhas.length === 0} className="btn-primary px-6 disabled:opacity-50">
          {saving ? <><Loader2 size={15} className="animate-spin" /> Salvando…</> : (edicao ? 'Salvar alterações' : 'Salvar orçamento')}
        </button>
      </div>
    </div>
  )
}
