import Link from 'next/link'
import {
  LayoutDashboard, Package, BookOpen, ShoppingBag, TrendingUp,
  ArrowRight, AlertTriangle, BarChart2, TrendingDown, Clock, Plus
} from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { SectionLabel } from '@/app/components/ui/section-label'
import { createClient } from '@/lib/supabase/server'
import { getUnidadePreferida } from '@/app/actions/unidade'
import { formatBRL } from '@/lib/format'

interface PrejuizoItem {
  nome: string
  preco: number
  custo: number
  diff: number
  unidade: string
}

interface UltimaFicha {
  id: string
  nome: string
  updated_at: string
}

function tempoAtras(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const d = Math.floor(diffMs / 86_400_000)
  if (d === 0) return 'hoje'
  if (d === 1) return 'ontem'
  if (d < 7) return `há ${d} dias`
  if (d < 30) return `há ${Math.floor(d / 7)} semana${Math.floor(d / 7) > 1 ? 's' : ''}`
  if (d < 365) return `há ${Math.floor(d / 30)} mês${Math.floor(d / 30) > 1 ? 'es' : ''}`
  return `há ${Math.floor(d / 365)} ano${Math.floor(d / 365) > 1 ? 's' : ''}`
}

export default async function ResumePage() {
  const [unidadeId, supabase] = await Promise.all([getUnidadePreferida(), createClient()])

  let insumoCountQ   = supabase.from('insumo').select('*', { count: 'exact', head: true }).eq('ativo', true)
  let receitaCountQ  = supabase.from('receita').select('*', { count: 'exact', head: true }).eq('ativo', true)
  let produtoCountQ  = supabase.from('produto').select('*', { count: 'exact', head: true }).eq('ativo', true)
  let insumoIdsQ     = supabase.from('insumo').select('id').eq('ativo', true)
  let nomesQ         = supabase.from('insumo').select('id, nome').eq('ativo', true)
  let produtosQ      = supabase.from('produto').select('id, nome, receita_id').eq('ativo', true)
  let ultimasFichasQ = supabase.from('receita').select('id, nome, updated_at').eq('ativo', true).order('updated_at', { ascending: false }).limit(5)

  if (unidadeId) {
    insumoCountQ   = insumoCountQ.eq('unidade_id', unidadeId)
    receitaCountQ  = receitaCountQ.eq('unidade_id', unidadeId)
    produtoCountQ  = produtoCountQ.eq('unidade_id', unidadeId)
    insumoIdsQ     = insumoIdsQ.eq('unidade_id', unidadeId)
    nomesQ         = nomesQ.eq('unidade_id', unidadeId)
    produtosQ      = produtosQ.eq('unidade_id', unidadeId)
    ultimasFichasQ = ultimasFichasQ.eq('unidade_id', unidadeId)
  }

  const [insumoRes, receitaRes, produtoRes, insumoIdsRes, nomesRes, produtosRes, ultimasFichasRes] =
    await Promise.all([
      insumoCountQ,
      receitaCountQ,
      produtoCountQ,
      insumoIdsQ,
      nomesQ,
      produtosQ,
      ultimasFichasQ,
    ])

  type ProdutoRow = { id: string; nome: string; receita_id: string | null }

  const insumoIds  = (insumoIdsRes.data ?? []).map((i) => i.id)
  const produtoIds = (produtosRes.data as ProdutoRow[] ?? []).map((p) => p.id)
  const receitaIds = [...new Set(
    (produtosRes.data as ProdutoRow[] ?? []).filter((p) => p.receita_id).map((p) => p.receita_id as string)
  )]

  const [custosRes, itensRes, precoProdutoRes, custosReceitaRes] = await Promise.all([
    insumoIds.length > 0
      ? supabase.from('vw_insumo_custo_atual').select('insumo_id, custo_uso').in('insumo_id', insumoIds)
      : Promise.resolve({ data: [] }),
    insumoIds.length > 0
      ? supabase.from('receita_item').select('insumo_id, quantidade').not('insumo_id', 'is', null).in('insumo_id', insumoIds)
      : Promise.resolve({ data: [] }),
    produtoIds.length > 0
      ? supabase.from('produto_preco').select('produto_id, preco_praticado').in('produto_id', produtoIds)
      : Promise.resolve({ data: [] }),
    receitaIds.length > 0
      ? supabase.from('vw_custo_receita').select('id, custo_unitario, rendimento_unidade').in('id', receitaIds)
      : Promise.resolve({ data: [] }),
  ])

  const insumoCount  = insumoRes.count ?? 0
  const receitaCount = receitaRes.count ?? 0
  const produtoCount = produtoRes.error ? null : (produtoRes.count ?? 0)

  type CustoUsoRow  = { insumo_id: string; custo_uso: number | null }
  type CustoRRow    = { id: string; custo_unitario: number | null; rendimento_unidade: string }
  type PrecoProdRow = { produto_id: string; preco_praticado: number | null }
  type NomeRow      = { id: string; nome: string }
  type ItemRow      = { insumo_id: string | null; quantidade: number }

  const comCusto = new Set(
    (custosRes.data as CustoUsoRow[] ?? [])
      .filter((c) => c.custo_uso && c.custo_uso > 0)
      .map((c) => c.insumo_id)
  )
  const insumosSemPreco = insumoIds.filter((id) => !comCusto.has(id)).length

  const custoReceitaMap = new Map<string, { custo_unitario: number; rendimento_unidade: string }>(
    (custosReceitaRes.data as CustoRRow[] ?? [])
      .filter((r) => r.custo_unitario != null)
      .map((r) => [r.id, { custo_unitario: r.custo_unitario as number, rendimento_unidade: r.rendimento_unidade }])
  )
  const precoProdutoMap = new Map<string, number>()
  for (const pp of (precoProdutoRes.data as PrecoProdRow[] ?? [])) {
    if (pp.preco_praticado != null && !precoProdutoMap.has(pp.produto_id))
      precoProdutoMap.set(pp.produto_id, pp.preco_praticado)
  }
  const prejuizoItems: PrejuizoItem[] = []
  for (const p of (produtosRes.data as ProdutoRow[] ?? [])) {
    if (!p.receita_id) continue
    const receita = custoReceitaMap.get(p.receita_id)
    if (!receita) continue
    const preco = precoProdutoMap.get(p.id)
    if (preco == null) continue
    if (preco < receita.custo_unitario)
      prejuizoItems.push({ nome: p.nome, preco, custo: receita.custo_unitario, diff: preco - receita.custo_unitario, unidade: receita.rendimento_unidade })
  }

  const hasAtencao = insumosSemPreco > 0 || prejuizoItems.length > 0

  const custoUsoMap = new Map<string, number>(
    (custosRes.data as CustoUsoRow[] ?? []).map((c) => [c.insumo_id, c.custo_uso ?? 0])
  )
  const nomeMap = new Map<string, string>(
    (nomesRes.data as NomeRow[] ?? []).map((i) => [i.id, i.nome])
  )
  const custoAcum = new Map<string, number>()
  for (const item of (itensRes.data as ItemRow[] ?? [])) {
    if (!item.insumo_id) continue
    const custo = custoUsoMap.get(item.insumo_id)
    if (!custo || custo <= 0) continue
    const nome = nomeMap.get(item.insumo_id) ?? ''
    if (nome.toLowerCase().includes('pendente')) continue
    custoAcum.set(item.insumo_id, (custoAcum.get(item.insumo_id) ?? 0) + item.quantidade * custo)
  }
  const totalCusto = [...custoAcum.values()].reduce((s, v) => s + v, 0)
  const abcTop5 = [...custoAcum.entries()]
    .filter(([id]) => nomeMap.has(id))
    .map(([id, custo]) => ({ nome: nomeMap.get(id)!, percentual: totalCusto > 0 ? (custo / totalCusto) * 100 : 0 }))
    .sort((a, b) => b.percentual - a.percentual)
    .slice(0, 5)

  const ultimasFichas: UltimaFicha[] = ultimasFichasRes.error
    ? []
    : (ultimasFichasRes.data ?? []).filter((f): f is UltimaFicha => !!(f as UltimaFicha).updated_at)

  const cards = [
    { label: 'INSUMOS CADASTRADOS', icon: Package, href: '/dashboard/insumos', valueStr: insumoCount.toString(), sub: 'matérias-primas com custo' },
    { label: 'FICHAS TÉCNICAS', icon: BookOpen, href: '/dashboard/receitas', valueStr: receitaCount.toString(), sub: 'receitas e sub-receitas' },
    { label: 'PRODUTOS ATIVOS', icon: ShoppingBag, href: '/dashboard/precos', valueStr: produtoCount != null ? produtoCount.toString() : null, sub: 'cadastrados para venda' },
    { label: 'PAINEL FINANCEIRO', icon: TrendingUp, href: '/dashboard/painel', valueStr: precoProdutoMap.size.toString(), sub: 'produtos com preço · ver margens' },
  ]

  return (
    <div className="max-w-2xl space-y-8">
      <PageTitle icon={LayoutDashboard} subtitle="Visão geral da padaria">
        Resumo
      </PageTitle>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/dashboard/receitas"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--t-accent) 12%, transparent)',
            color: 'var(--t-accent)',
            border: '1px solid color-mix(in srgb, var(--t-accent) 25%, transparent)',
          }}
        >
          <Plus size={14} />
          Nova Receita
        </Link>
        <Link
          href="/dashboard/insumos"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--t-accent) 12%, transparent)',
            color: 'var(--t-accent)',
            border: '1px solid color-mix(in srgb, var(--t-accent) 25%, transparent)',
          }}
        >
          <Plus size={14} />
          Novo Insumo
        </Link>
        <Link
          href="/dashboard/precos"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all"
          style={{
            backgroundColor: 'var(--t-input-bg)',
            color: 'var(--t-text-2)',
            border: '1px solid var(--t-input-border)',
          }}
        >
          Ver Preços
          <ArrowRight size={13} />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.label}
              href={card.href}
              className="card-surface p-6 block group cursor-pointer hover:shadow-lg transition-all duration-150 relative"
            >
              <div className="flex items-center gap-2 mb-3">
                <Icon size={13} style={{ color: 'var(--t-accent)', flexShrink: 0 }} />
                <p className="field-label">{card.label}</p>
              </div>
              {card.valueStr != null ? (
                <>
                  <p className="font-playfair text-[36px] font-bold leading-none" style={{ color: 'var(--t-accent)' }}>
                    {card.valueStr}
                  </p>
                  {card.sub && <p className="text-xs mt-2" style={{ color: 'var(--t-text-2)' }}>{card.sub}</p>}
                </>
              ) : (
                <p className="font-outfit text-lg font-medium" style={{ color: 'var(--t-text-2)' }}>Em breve</p>
              )}
              <ArrowRight size={14} className="absolute bottom-5 right-5 opacity-0 group-hover:opacity-100 transition-all" style={{ color: 'var(--t-accent)' }} />
            </Link>
          )
        })}
      </div>

      {hasAtencao && (
        <div className="space-y-3">
          <SectionLabel icon={AlertTriangle}>Precisa de atenção</SectionLabel>
          {insumosSemPreco > 0 && (
            <Link
              href="/dashboard/insumos?status=pendentes"
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/25 bg-amber-500/8 hover:bg-amber-500/12 transition-colors group"
            >
              <AlertTriangle size={15} className="text-amber-400 shrink-0" />
              <span className="text-amber-400/90 text-sm flex-1">
                {insumosSemPreco} insumo{insumosSemPreco !== 1 ? 's' : ''} sem preço cadastrado
              </span>
              <ArrowRight size={13} className="text-amber-400/40 group-hover:text-amber-400 transition-colors" />
            </Link>
          )}
          {prejuizoItems.map((item) => (
            <div key={item.nome} className="rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <TrendingDown size={14} className="text-red-400 shrink-0" />
                    <span className="text-red-400 text-sm font-semibold truncate">{item.nome}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20 uppercase tracking-wider">
                      Prejuízo
                    </span>
                  </div>
                  <p className="text-red-400/70 text-xs">
                    vende a R$ {formatBRL(item.preco)}/{item.unidade} · abaixo do custo de R$ {formatBRL(item.custo)}/{item.unidade}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-red-400 font-playfair text-lg font-bold leading-none">−R$ {formatBRL(Math.abs(item.diff))}</p>
                  <p className="text-red-400/60 text-[11px] mt-0.5">no vermelho</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-4">
        <SectionLabel icon={BarChart2}>Onde está o seu custo</SectionLabel>
        {abcTop5.length === 0 ? (
          <div className="rounded-xl px-5 py-6 text-center" style={{ backgroundColor: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)' }}>
            <p className="text-sm" style={{ color: 'var(--t-text-2)' }}>
              Os dados de custo aparecerão conforme você cadastrar preços de insumos e criar fichas técnicas.
            </p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)' }}>
            <div className="divide-y" style={{ borderColor: 'var(--t-border-sub)' }}>
              {abcTop5.map((item, idx) => (
                <div key={item.nome} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium" style={{ color: 'var(--t-text-1)' }}>{item.nome}</span>
                    <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--t-accent)' }}>{item.percentual.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--t-input-bg)' }}>
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${Math.min(item.percentual, 100)}%`,
                        background: idx === 0
                          ? 'linear-gradient(to right, var(--color-accent-hover), var(--color-accent-primary))'
                          : 'var(--color-accent-primary)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t" style={{ borderColor: 'var(--t-border-sub)', backgroundColor: 'var(--t-inset-bg)' }}>
              <p
                className="text-[11px]"
                style={{ color: 'var(--t-text-2)' }}
                title="Curva baseada em estimativa de custo × quantidade nas fichas técnicas."
              >
                Esses são os ingredientes que mais pesam no custo dos seus produtos.
              </p>
            </div>
          </div>
        )}
      </div>

      {ultimasFichas.length > 0 && (
        <div className="space-y-3">
          <SectionLabel icon={Clock}>Últimas fichas modificadas</SectionLabel>
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)' }}>
            <div className="divide-y" style={{ borderColor: 'var(--t-border-sub)' }}>
              {ultimasFichas.map((ficha) => (
                <Link
                  key={ficha.id}
                  href={`/dashboard/receitas/${ficha.id}`}
                  className="flex items-center justify-between px-5 py-3 transition-colors group"
                  style={{ ['--hover-bg' as string]: 'var(--t-row-hover)' }}
                  onMouseEnter={undefined}
                >
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--t-text-1)' }}>
                    {ficha.nome}
                  </span>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-xs" style={{ color: 'var(--t-text-2)' }}>
                      {tempoAtras(ficha.updated_at)}
                    </span>
                    <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-all" style={{ color: 'var(--t-accent)' }} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
