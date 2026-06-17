import { createClient } from '@/lib/supabase/server'
import { Package } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { InsumoList } from './components/insumo-list'
import { UnidadeSelector } from '@/app/components/unidade-selector'
import type { CustoAtual, InsumoComCusto } from './types'

export default async function InsumosPage() {
  const supabase = await createClient()

  const [insumosRes, custosRes, precosRes, usosRes] = await Promise.all([
    supabase.from('insumo').select('*').eq('ativo', true).order('nome'),
    supabase.from('vw_insumo_custo_atual').select('insumo_id, custo_uso'),
    supabase.from('insumo_preco').select('insumo_id, unidade_compra, preco_compra, qtd_uso_por_compra, vigente_desde').order('vigente_desde', { ascending: false }),
    supabase.from('receita_item').select('insumo_id, receita_id').not('insumo_id', 'is', null),
  ])

  // Build custo_uso map from view
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const custoUsoMap = new Map<string, number>((custosRes.data ?? []).map((c: any) => [c.insumo_id, c.custo_uso]))

  // Get latest insumo_preco per insumo (already ordered DESC)
  const latestPrecoMap = new Map<string, CustoAtual>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const p of (precosRes.data ?? []) as any[]) {
    if (!latestPrecoMap.has(p.insumo_id)) {
      latestPrecoMap.set(p.insumo_id, {
        insumo_id: p.insumo_id,
        custo_uso: custoUsoMap.get(p.insumo_id) ?? null,
        preco_compra: p.preco_compra,
        unidade_compra: p.unidade_compra,
        qtd_uso_por_compra: p.qtd_uso_por_compra,
        vigente_desde: p.vigente_desde,
      })
    }
  }

  // Compute distinct receita count per insumo
  const fichasPerInsumo = new Map<string, Set<string>>()
  for (const row of usosRes.data ?? []) {
    if (!row.insumo_id) continue
    if (!fichasPerInsumo.has(row.insumo_id)) fichasPerInsumo.set(row.insumo_id, new Set())
    fichasPerInsumo.get(row.insumo_id)!.add(row.receita_id)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insumos: InsumoComCusto[] = (insumosRes.data ?? []).map((i: any) => ({
    ...i,
    custo: latestPrecoMap.get(i.id) ?? null,
    fichasCount: fichasPerInsumo.get(i.id)?.size ?? 0,
  }))

  const categorias = [
    ...new Set(
      insumos.map((i) => i.categoria).filter((c): c is string => Boolean(c))
    ),
  ].sort()

  return (
    <div>
      <UnidadeSelector />
      <PageTitle icon={Package}>Insumos</PageTitle>
      <InsumoList insumos={insumos} categorias={categorias} />
    </div>
  )
}
