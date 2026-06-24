import { createClient } from '@/lib/supabase/server'
import { Package } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { InsumoList } from './components/insumo-list'
import { getUnidadePreferida } from '@/app/actions/unidade'
import type { Insumo, CustoAtual, InsumoComCusto } from './types'

export default async function InsumosPage() {
  const [unidadeId, supabase] = await Promise.all([getUnidadePreferida(), createClient()])

  let insumosQuery = supabase.from('insumo').select('*').eq('ativo', true).order('nome')
  if (unidadeId) insumosQuery = insumosQuery.eq('unidade_id', unidadeId)

  const insumosRes = await insumosQuery
  const insumos_raw = (insumosRes.data as Insumo[] ?? [])
  const insumoIds = insumos_raw.map((i) => i.id)

  // Escopo defensivo: filtra pelo conjunto de IDs que o usuário já pode ver,
  // evitando vazar dados de outros tenants caso as políticas RLS dessas
  // tabelas secundárias não estejam cobrindo todos os cenários.
  const [custosRes, precosRes, usosRes] = insumoIds.length > 0
    ? await Promise.all([
        supabase.from('vw_insumo_custo_atual').select('insumo_id, custo_uso').in('insumo_id', insumoIds),
        supabase.from('insumo_preco')
          .select('insumo_id, unidade_compra, preco_compra, qtd_uso_por_compra, vigente_desde')
          .in('insumo_id', insumoIds)
          .order('vigente_desde', { ascending: false }),
        supabase.from('receita_item')
          .select('insumo_id, receita_id')
          .not('insumo_id', 'is', null)
          .in('insumo_id', insumoIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }]

  type CustoUso2 = { insumo_id: string; custo_uso: number | null }
  type PrecoRow3 = { insumo_id: string; unidade_compra: string; preco_compra: number; qtd_uso_por_compra: number; vigente_desde: string }

  const custoUsoMap = new Map<string, number>(
    (custosRes.data as CustoUso2[] ?? []).map((c) => [c.insumo_id, c.custo_uso ?? 0])
  )

  const latestPrecoMap = new Map<string, CustoAtual>()
  for (const p of (precosRes.data as PrecoRow3[] ?? [])) {
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

  const fichasPerInsumo = new Map<string, Set<string>>()
  for (const row of usosRes.data ?? []) {
    if (!row.insumo_id) continue
    if (!fichasPerInsumo.has(row.insumo_id)) fichasPerInsumo.set(row.insumo_id, new Set())
    fichasPerInsumo.get(row.insumo_id)!.add(row.receita_id)
  }

  const insumos: InsumoComCusto[] = insumos_raw.map((i) => ({
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
      <PageTitle icon={Package}>Insumos</PageTitle>
      <InsumoList insumos={insumos} categorias={categorias} />
    </div>
  )
}
