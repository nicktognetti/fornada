import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FichaView } from '../components/ficha-view'
import type { Receita, ReceitaItem, ReceitaItemComCusto } from '../types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function FichaPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch receita + custo em paralelo
  const [receitaRes, custoRes, itemsRes] = await Promise.all([
    supabase.from('receita').select('*').eq('id', id).single(),
    supabase.from('vw_custo_receita').select('custo_total, custo_unitario').eq('id', id).single(),
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
      .eq('receita_id', id),
  ])

  if (receitaRes.error || !receitaRes.data) notFound()

  const receita = receitaRes.data as Receita
  const custo = custoRes.data

  // Fetch custos dos insumos usados
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawItems: any[] = itemsRes.data ?? []
  const insumoIds = rawItems.filter(i => i.insumo_id).map(i => i.insumo_id as string)
  const subIds = rawItems.filter(i => i.sub_receita_id).map(i => i.sub_receita_id as string)

  const [custosInsumoRes, custosSubRes] = await Promise.all([
    insumoIds.length > 0
      ? supabase.from('vw_insumo_custo_atual').select('insumo_id, custo_uso').in('insumo_id', insumoIds)
      : Promise.resolve({ data: [] }),
    subIds.length > 0
      ? supabase.from('vw_custo_receita').select('id, custo_unitario').in('id', subIds)
      : Promise.resolve({ data: [] }),
  ])

  const custoInsumoMap = new Map(
    (custosInsumoRes.data ?? []).map((c: any) => [c.insumo_id, c.custo_uso as number])
  )
  const custoSubMap = new Map(
    (custosSubRes.data ?? []).map((c: any) => [c.id, c.custo_unitario as number])
  )

  // Montar itens com custo
  const itens: ReceitaItemComCusto[] = rawItems.map((r: any) => {
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

  return (
    <div>
      <Link
        href="/dashboard/receitas"
        className="inline-flex items-center gap-1.5 text-[#9e9e9e] hover:text-[#d68a57] text-sm mb-6 transition-all hover:-translate-x-0.5"
      >
        <ArrowLeft size={15} />
        Fichas Técnicas
      </Link>

      <FichaView
        receita={receita}
        custo={custo ?? null}
        itens={itens}
      />
    </div>
  )
}
