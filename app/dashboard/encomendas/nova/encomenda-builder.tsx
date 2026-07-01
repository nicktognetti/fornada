'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList, Plus, Trash2, Loader2 } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { parseDecimalBR, formatBRL } from '@/lib/format'
import { precoComAjuste, subtotalItem, totalPedido } from '@/lib/pedido-calc'
import { criarEncomenda } from '@/app/actions/encomenda'
import type { ProdutoOrcamento } from '@/app/actions/orcamento'

interface Linha {
  key: number
  produto_id: string | null
  descricao: string
  base: number
  quantidade: string
  ajustePct: string
  preco: string
  obs: string
}

function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function EncomendaBuilder({ produtos }: { produtos: ProdutoOrcamento[] }) {
  const router = useRouter()
  const [cliente, setCliente] = useState('')
  const [contato, setContato] = useState('')
  const [data, setData] = useState(hojeISO)
  const [hora, setHora] = useState('')
  const [comValor, setComValor] = useState(false)
  const [obs, setObs] = useState('')
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [selProduto, setSelProduto] = useState('')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const keyRef = useState(() => ({ n: 0 }))[0]

  function addProduto() {
    const p = produtos.find((x) => x.id === selProduto)
    if (!p) return
    setLinhas((prev) => [...prev, {
      key: (keyRef.n += 1), produto_id: p.id, descricao: p.nome, base: p.preco_base,
      quantidade: '1', ajustePct: '', preco: p.preco_base > 0 ? p.preco_base.toFixed(2) : '', obs: '',
    }])
    setSelProduto('')
    setErro(null)
  }

  function addAvulso() {
    setLinhas((prev) => [...prev, {
      key: (keyRef.n += 1), produto_id: null, descricao: '', base: 0,
      quantidade: '1', ajustePct: '', preco: '', obs: '',
    }])
    setErro(null)
  }

  function upd(key: number, campo: keyof Linha, valor: string) {
    setLinhas((prev) => prev.map((l) => {
      if (l.key !== key) return l
      const next = { ...l, [campo]: valor }
      if (campo === 'ajustePct') {
        const pct = parseDecimalBR(valor)
        if (l.base > 0 && !isNaN(pct)) next.preco = precoComAjuste(l.base, pct).toFixed(2)
      }
      return next
    }))
    setErro(null)
  }

  const total = useMemo(
    () => totalPedido(linhas.map((l) => ({ quantidade: parseDecimalBR(l.quantidade), precoUnitario: parseDecimalBR(l.preco) }))),
    [linhas],
  )

  async function salvar() {
    if (!cliente.trim()) { setErro('Informe o cliente'); return }
    if (!data) { setErro('Informe a data de entrega'); return }
    if (linhas.length === 0) { setErro('Adicione ao menos um item'); return }
    setSaving(true); setErro(null)
    const res = await criarEncomenda(
      { cliente_nome: cliente, cliente_contato: contato, data_entrega: data, hora_entrega: hora, com_valor: comValor, observacao: obs },
      linhas.map((l) => ({
        produto_id: l.produto_id, descricao: l.descricao,
        quantidade: parseDecimalBR(l.quantidade), preco_unitario: parseDecimalBR(l.preco) || 0, observacao: l.obs,
      })),
    )
    setSaving(false)
    if (res.error || !res.data) { setErro(res.error ?? 'Erro ao salvar'); return }
    router.push(`/dashboard/encomendas/${res.data.id}`)
  }

  const INPUT = 'input-field text-sm'

  return (
    <div className="max-w-3xl space-y-6">
      <PageTitle icon={ClipboardList} subtitle="Lance a encomenda e imprima a comanda pra produção">Nova encomenda</PageTitle>

      {/* Cliente + entrega */}
      <div className="card-surface p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1 sm:col-span-2">
          <label className="field-label">Cliente *</label>
          <input value={cliente} onChange={(e) => setCliente(e.target.value)} className={INPUT} placeholder="Nome do cliente" />
        </div>
        <div className="space-y-1">
          <label className="field-label">Contato</label>
          <input value={contato} onChange={(e) => setContato(e.target.value)} className={INPUT} placeholder="Telefone / WhatsApp" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="field-label">Entrega *</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={INPUT} />
          </div>
          <div className="space-y-1">
            <label className="field-label">Hora</label>
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={INPUT} />
          </div>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="field-label">Observação geral</label>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} className={`${INPUT} min-h-[56px]`} placeholder="Forma de pagamento, retirada/entrega…" />
        </div>
        <label className="sm:col-span-2 flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={comValor} onChange={(e) => setComValor(e.target.checked)} className="accent-[var(--color-accent-primary)]" />
          <span className="text-sm text-ink-soft">Registrar valor (preços e total) — para controle da Natali</span>
        </label>
      </div>

      {/* Adicionar produto */}
      <div className="flex gap-2">
        <select value={selProduto} onChange={(e) => setSelProduto(e.target.value)} className="input-field text-sm flex-1">
          <option value="">Selecione um produto…</option>
          {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <button onClick={addProduto} disabled={!selProduto} className="btn-primary px-4 shrink-0 disabled:opacity-50">
          <Plus size={15} /> Adicionar
        </button>
        <button onClick={addAvulso} title="Adicionar um item que não está no catálogo" className="px-4 shrink-0 rounded-xl text-sm font-medium border border-subtle text-ink-soft hover:text-primary hover:bg-input transition-colors">
          + Avulso
        </button>
      </div>

      {/* Itens */}
      {linhas.length > 0 && (
        <div className="space-y-2">
          {linhas.map((l) => {
            const sub = subtotalItem(parseDecimalBR(l.quantidade), parseDecimalBR(l.preco))
            return (
              <div key={l.key} className="card-surface p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input value={l.descricao} onChange={(e) => upd(l.key, 'descricao', e.target.value)} className="input-field text-sm py-1.5 flex-1" placeholder="Descrição do item" />
                  <button onClick={() => setLinhas((prev) => prev.filter((x) => x.key !== l.key))} className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary/40 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0" aria-label="Remover item">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-faint">Qtd</span>
                    <input value={l.quantidade} inputMode="decimal" onChange={(e) => upd(l.key, 'quantidade', e.target.value)} className="input-field text-sm py-1.5 px-2 w-16 text-right tabular-nums" placeholder="1" />
                  </div>
                  {comValor && (
                    <>
                      <span className="text-[11px] text-faint">base {l.base > 0 ? `R$ ${formatBRL(l.base)}` : '—'}</span>
                      <div className="flex items-center gap-1.5">
                        <input value={l.ajustePct} inputMode="decimal" onChange={(e) => upd(l.key, 'ajustePct', e.target.value)} className="input-field text-sm py-1.5 px-2 w-14 text-right tabular-nums" placeholder="%" title="% sobre o preço base" />
                        <span className="text-[11px] text-faint">%</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-faint">R$</span>
                        <input value={l.preco} inputMode="decimal" onChange={(e) => upd(l.key, 'preco', e.target.value)} className="input-field text-sm py-1.5 px-2 w-20 text-right tabular-nums" placeholder="0,00" />
                      </div>
                      <span className="text-sm font-medium text-primary tabular-nums ml-auto">R$ {formatBRL(sub)}</span>
                    </>
                  )}
                </div>
                <input value={l.obs} onChange={(e) => upd(l.key, 'obs', e.target.value)} className="input-field text-xs py-1.5" placeholder="Obs. do item (ex: sem lactose, escrever 'Parabéns João')" />
              </div>
            )
          })}
          {comValor && (
            <div className="flex items-center justify-between px-4 py-3 card-surface">
              <span className="text-sm text-secondary">Total</span>
              <span className="font-playfair text-accent-primary text-2xl font-bold tabular-nums">R$ {formatBRL(total)}</span>
            </div>
          )}
        </div>
      )}

      {erro && <p className="text-sm text-danger bg-danger-tint rounded-lg px-3 py-2">{erro}</p>}

      <div className="flex justify-end gap-3">
        <button onClick={() => router.push('/dashboard/encomendas')} className="px-5 py-2.5 rounded-lg border border-subtle text-ink-soft hover:bg-input text-sm">Cancelar</button>
        <button onClick={salvar} disabled={saving || linhas.length === 0} className="btn-primary px-6 disabled:opacity-50">
          {saving ? <><Loader2 size={15} className="animate-spin" /> Salvando…</> : 'Salvar encomenda'}
        </button>
      </div>
    </div>
  )
}
