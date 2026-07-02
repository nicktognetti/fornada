'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList, Trash2, Loader2 } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { ProdutoPicker } from '@/app/components/ui/produto-picker'
import { parseDecimalBR, formatBRL } from '@/lib/format'
import { precoComAjuste, subtotalItem, totalPedido } from '@/lib/pedido-calc'
import { criarEncomenda, atualizarEncomenda } from '@/app/actions/encomenda'
import type { ProdutoOrcamento } from '@/app/actions/orcamento'
import type { ClienteAutocomplete } from '@/app/actions/cliente'

interface Linha {
  key: number
  produto_id: string | null
  descricao: string
  base: number
  quantidade: string
  ajustePct: string
  preco: string
  obs: string
  local: string | null
  unidade: string | null
}

export type EncomendaEdicao = {
  id: string
  cliente_nome: string
  cliente_contato: string | null
  data_entrega: string
  hora_entrega: string | null
  rastrear_status: boolean
  observacao: string | null
  itens: { produto_id: string | null; descricao: string; quantidade: number; preco_unitario: number; observacao: string | null; local: string | null }[]
}

function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function EncomendaBuilder({ produtos, clientes, locais, edicao }: { produtos: ProdutoOrcamento[]; clientes: ClienteAutocomplete[]; locais: string[]; edicao?: EncomendaEdicao }) {
  const router = useRouter()
  const keyRef = useState(() => ({ n: 0 }))[0]
  const [cliente, setCliente] = useState(edicao?.cliente_nome ?? '')
  const [contato, setContato] = useState(edicao?.cliente_contato ?? '')
  const [data, setData] = useState(edicao?.data_entrega ?? hojeISO())
  const [hora, setHora] = useState(edicao?.hora_entrega?.slice(0, 5) ?? '')
  const [rastrear, setRastrear] = useState(edicao?.rastrear_status ?? true)
  const [obs, setObs] = useState(edicao?.observacao ?? '')
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    (edicao?.itens ?? []).map((it) => ({
      key: (keyRef.n += 1), produto_id: it.produto_id, descricao: it.descricao, base: it.preco_unitario,
      quantidade: String(it.quantidade), ajustePct: '', preco: it.preco_unitario > 0 ? it.preco_unitario.toFixed(2) : '', obs: it.observacao ?? '', local: it.local ?? null,
      unidade: it.produto_id ? (produtos.find((pp) => pp.id === it.produto_id)?.unidade_venda ?? null) : null,
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
        key: (keyRef.n += 1), produto_id: p.id, descricao: p.nome, base: p.preco_base,
        quantidade: '1', ajustePct: '', preco: p.preco_base > 0 ? p.preco_base.toFixed(2) : '', obs: '', local: p.local ?? null,
        unidade: p.unidade_venda,
      }]
    })
    setErro(null)
  }

  function addAvulso() {
    setLinhas((prev) => [...prev, {
      key: (keyRef.n += 1), produto_id: null, descricao: '', base: 0,
      quantidade: '1', ajustePct: '', preco: '', obs: '', local: null, unidade: null,
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
    if (!hora) { setErro('Informe a hora de entrega'); return }
    if (linhas.length === 0) { setErro('Adicione ao menos um item'); return }
    // Cada item precisa de descrição (avulso), quantidade e valor > 0.
    for (const l of linhas) {
      const nomeItem = (l.produto_id === null ? l.descricao : l.descricao).trim()
      if (l.produto_id === null && !nomeItem) { setErro('Descreva o item avulso antes de salvar'); return }
      const q = parseDecimalBR(l.quantidade)
      if (!q || q <= 0) { setErro(`Informe a quantidade de "${nomeItem || 'item'}"`); return }
      const p = parseDecimalBR(l.preco)
      if (!p || p <= 0) { setErro(`Informe o valor de "${nomeItem || 'item avulso'}" (não pode ficar em R$ 0,00)`); return }
    }
    setSaving(true); setErro(null)
    const dados = { cliente_nome: cliente, cliente_contato: contato, data_entrega: data, hora_entrega: hora, com_valor: true, rastrear_status: rastrear, observacao: obs }
    const itens = linhas.map((l) => ({
      produto_id: l.produto_id, descricao: l.descricao,
      quantidade: parseDecimalBR(l.quantidade), preco_unitario: parseDecimalBR(l.preco) || 0, observacao: l.obs, local: l.local,
    }))
    const res = edicao
      ? await atualizarEncomenda(edicao.id, dados, itens)
      : await criarEncomenda(dados, itens)
    setSaving(false)
    if (res.error || !res.data) { setErro(res.error ?? 'Erro ao salvar'); return }
    router.push(`/dashboard/encomendas/${res.data.id}`)
  }

  const INPUT = 'input-field text-sm'

  return (
    <div className="max-w-3xl space-y-6">
      <PageTitle icon={ClipboardList} subtitle="Lance a encomenda e imprima a comanda pra produção">{edicao ? 'Editar encomenda' : 'Nova encomenda'}</PageTitle>

      {/* Cliente + entrega */}
      <div className="card-surface p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1 sm:col-span-2">
          <label className="field-label">Cliente *</label>
          <input list="clientes-list" autoComplete="off" value={cliente} placeholder="Nome do cliente" className={INPUT}
            onChange={(e) => { const v = e.target.value; setCliente(v); const c = clientes.find((x) => x.nome === v); if (c?.telefone) setContato(c.telefone) }} />
          <datalist id="clientes-list">{clientes.map((c) => <option key={c.nome} value={c.nome} />)}</datalist>
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
            <label className="field-label">Hora *</label>
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={INPUT} />
          </div>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="field-label">Observação geral</label>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} className={`${INPUT} min-h-[56px]`} placeholder="Forma de pagamento, retirada/entrega…" />
        </div>
        <label className="sm:col-span-2 flex items-start gap-3 cursor-pointer rounded-lg border border-subtle px-4 py-3 hover:bg-input transition-colors">
          <input type="checkbox" checked={rastrear} onChange={(e) => setRastrear(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[var(--t-accent)] cursor-pointer" />
          <span className="min-w-0">
            <span className="text-sm text-primary font-medium">Acompanhar produção</span>
            <span className="block text-xs text-secondary mt-0.5">
              Liga o fluxo de etapas (pendente → produzindo → pronto → entregue). Desligue para itens só de revenda (ex: refrigerante), que vão direto de pendente para entregue.
            </span>
          </span>
        </label>
      </div>

      {/* Adicionar produto */}
      <ProdutoPicker produtos={produtos} onPick={addProduto} onAvulso={addAvulso} />

      {/* Itens */}
      {linhas.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] text-faint px-1">
            Dica: no campo <span className="text-secondary font-medium">%</span> digite um número (ex: <span className="text-secondary font-medium">10</span>) para ajustar o preço em +10% sobre o base. Itens avulsos têm preço livre.
          </p>
          {linhas.map((l) => {
            const isAvulso = l.produto_id === null
            const sub = subtotalItem(parseDecimalBR(l.quantidade), parseDecimalBR(l.preco))
            return (
              <div key={l.key} className="card-surface p-3 space-y-2">
                <div className="flex items-center gap-2">
                  {isAvulso ? (
                    <input value={l.descricao} onChange={(e) => upd(l.key, 'descricao', e.target.value)} className="input-field text-sm py-1.5 flex-1" placeholder="Descrição do item avulso" />
                  ) : (
                    <span className="flex-1 text-sm text-primary py-1.5 truncate" title={l.descricao}>{l.descricao}</span>
                  )}
                  <button onClick={() => setLinhas((prev) => prev.filter((x) => x.key !== l.key))} className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary/40 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0" aria-label="Remover item">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-faint">Qtd</span>
                    <input value={l.quantidade} inputMode="decimal" onChange={(e) => upd(l.key, 'quantidade', e.target.value)} className="input-field text-sm py-1.5 px-2 w-16 text-right tabular-nums" placeholder="1" />
                    {l.unidade && <span className="text-[11px] text-secondary font-medium">{l.unidade}</span>}
                  </div>
                  <span className="text-[11px] text-faint">base {l.base > 0 ? `R$ ${formatBRL(l.base)}${l.unidade ? `/${l.unidade}` : ''}` : '—'}</span>
                  <div className="flex items-center gap-1.5">
                    <input value={l.ajustePct} inputMode="decimal" disabled={isAvulso} onChange={(e) => upd(l.key, 'ajustePct', e.target.value)} className={`input-field text-sm py-1.5 px-2 w-14 text-right tabular-nums ${isAvulso ? 'opacity-40 cursor-not-allowed' : ''}`} placeholder="%" title={isAvulso ? 'Ajuste % vale só para itens do catálogo' : '% sobre o preço base'} />
                    <span className="text-[11px] text-faint">%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-faint">R$</span>
                    {isAvulso ? (
                      <input value={l.preco} inputMode="decimal" onChange={(e) => upd(l.key, 'preco', e.target.value)} className="input-field text-sm py-1.5 px-2 w-20 text-right tabular-nums" placeholder="0,00" />
                    ) : (
                      <span className="text-sm text-primary tabular-nums w-20 text-right inline-block" title="Preço do catálogo — ajuste pela %">{l.preco ? formatBRL(parseDecimalBR(l.preco)) : '—'}</span>
                    )}
                  </div>
                  <span className="text-sm font-medium text-primary tabular-nums ml-auto">R$ {formatBRL(sub)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input value={l.obs} onChange={(e) => upd(l.key, 'obs', e.target.value)} className="input-field text-xs py-1.5 flex-1" placeholder="Obs. do item (ex: sem lactose, escrever 'Parabéns João')" />
                  <select value={l.local ?? ''} onChange={(e) => upd(l.key, 'local', e.target.value)} className="input-field text-xs py-1.5 w-36 shrink-0" title="Setor de produção deste item">
                    <option value="">Sem local</option>
                    {locais.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
                    {l.local && !locais.includes(l.local) && <option value={l.local}>{l.local}</option>}
                  </select>
                </div>
              </div>
            )
          })}
          <div className="flex items-center justify-between px-4 py-3 card-surface">
            <span className="text-sm text-secondary">Total</span>
            <span className="font-playfair text-accent-primary text-2xl font-bold tabular-nums">R$ {formatBRL(total)}</span>
          </div>
        </div>
      )}

      {erro && <p className="text-sm text-danger bg-danger-tint rounded-lg px-3 py-2">{erro}</p>}

      <div className="flex justify-end gap-3">
        <button onClick={() => router.push(edicao ? `/dashboard/encomendas/${edicao.id}` : '/dashboard/encomendas')} className="px-5 py-2.5 rounded-lg border border-subtle text-ink-soft hover:bg-input text-sm">Cancelar</button>
        <button onClick={salvar} disabled={saving || linhas.length === 0} className="btn-primary px-6 disabled:opacity-50">
          {saving ? <><Loader2 size={15} className="animate-spin" /> Salvando…</> : (edicao ? 'Salvar alterações' : 'Salvar encomenda')}
        </button>
      </div>
    </div>
  )
}
