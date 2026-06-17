import { createClient } from '@/lib/supabase/server'
import { Package } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { InsumoList } from './components/insumo-list'
import type { CustoAtual, InsumoComCusto } from './types'

export default async function InsumosPage() {
  const supabase = await createClient()

  const [insumosRes, custosRes] = await Promise.all([
    supabase.from('insumo').select('*').eq('ativo', true).order('nome'),
    supabase.from('vw_insumo_custo_atual').select('*'),
  ])

  const custoMap = new Map<string, CustoAtual>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (custosRes.data ?? []).map((c: any) => [c.insumo_id, c as CustoAtual])
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insumos: InsumoComCusto[] = (insumosRes.data ?? []).map((i: any) => ({
    ...i,
    custo: custoMap.get(i.id) ?? null,
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
