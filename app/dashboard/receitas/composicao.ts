import { createClient } from '@/lib/supabase/server'
import type { ReceitaItem, ReceitaItemComCusto } from './types'

export interface ReceitaComposicao {
  custo: { custo_total: number | null; custo_unitario: number | null } | null
  itens: ReceitaItemComCusto[]
}

type ItemRaw = {
  id: string; receita_id: string; insumo_id: string | null; sub_receita_id: string | null
  quantidade: number
  insumo: { id: string; nome: string; unidade_uso: string } | null
  sub_receita: { id: string; nome: string; rendimento_unidade: string } | null
}
type CustoInsumoRow = { insumo_id: string; custo_uso: number }
type CustoSubRow = { id: string; custo_unitario: number }

/**
 * Monta a composição de custo de uma receita: custo total/unitário (de
 * vw_custo_receita) + lista de itens com custo por unidade e custo do item.
 * Núcleo compartilhado entre a página da ficha e o drawer de detalhe de produto.
 */
export async function getReceitaComposicao(receitaId: string): Promise<ReceitaComposicao> {
  const supabase = await createClient()

  const [custoRes, itemsRes] = await Promise.all([
    supabase.from('vw_custo_receita').select('custo_total, custo_unitario').eq('id', receitaId).maybeSingle(),
    supabase
      .from('receita_item')
      .select(`
        id,
        receita_id,
        insumo_id,
        sub_receita_id,
        quantidade,
        insumo:insumo_id ( id, nome, unidade_uso ),
        sub_receita:receita!sub_receita_id ( id, nome, rendimento_unidade )
      `)
      .eq('receita_id', receitaId),
  ])

  const rawItems: ItemRaw[] = (itemsRes.data as unknown as ItemRaw[]) ?? []
  const insumoIds = rawItems.filter((i) => i.insumo_id).map((i) => i.insumo_id as string)
  const subIds = rawItems.filter((i) => i.sub_receita_id).map((i) => i.sub_receita_id as string)

  const [custosInsumoRes, custosSubRes] = await Promise.all([
    insumoIds.length > 0
      ? supabase.from('vw_insumo_custo_atual').select('insumo_id, custo_uso').in('insumo_id', insumoIds)
      : Promise.resolve({ data: [] as CustoInsumoRow[] }),
    subIds.length > 0
      ? supabase.from('vw_custo_receita').select('id, custo_unitario').in('id', subIds)
      : Promise.resolve({ data: [] as CustoSubRow[] }),
  ])

  const custoInsumoMap = new Map<string, number>(
    (custosInsumoRes.data as CustoInsumoRow[] ?? []).map((c) => [c.insumo_id, c.custo_uso])
  )
  const custoSubMap = new Map<string, number>(
    (custosSubRes.data as CustoSubRow[] ?? []).map((c) => [c.id, c.custo_unitario])
  )

  const itens: ReceitaItemComCusto[] = rawItems.map((r) => {
    const item: ReceitaItem = {
      id: r.id,
      receita_id: r.receita_id,
      insumo_id: r.insumo_id,
      sub_receita_id: r.sub_receita_id,
      quantidade: r.quantidade,
      insumo: r.insumo ?? null,
      sub_receita: r.sub_receita ?? null,
    }
    const isInsumo = !!item.insumo_id
    const nome_display = item.insumo?.nome ?? item.sub_receita?.nome ?? '—'
    const unidade = item.insumo?.unidade_uso ?? item.sub_receita?.rendimento_unidade ?? ''
    const custo_unitario = isInsumo
      ? (custoInsumoMap.get(item.insumo_id!) ?? null)
      : (custoSubMap.get(item.sub_receita_id!) ?? null)
    const custo_item = custo_unitario != null ? item.quantidade * custo_unitario : null
    const is_pendente =
      nome_display.toLowerCase().includes('pendente') ||
      (!item.insumo_id && !item.sub_receita_id)

    return { ...item, nome_display, unidade, custo_unitario, custo_item, is_pendente }
  })

  return { custo: custoRes.data ?? null, itens }
}
