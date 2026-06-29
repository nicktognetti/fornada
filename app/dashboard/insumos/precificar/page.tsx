import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getUnidadePreferida } from '@/app/actions/unidade'
import { PrecificarLoteGrid, type InsumoParaPrecificar } from './precificar-lote-grid'

export default async function PrecificarLotePage() {
  const [unidadeId, supabase] = await Promise.all([getUnidadePreferida(), createClient()])

  let q = supabase.from('insumo').select('id, nome, categoria, unidade_uso').eq('ativo', true).order('nome')
  if (unidadeId) q = q.eq('unidade_id', unidadeId)
  const insumosRes = await q
  const insumos = (insumosRes.data as { id: string; nome: string; categoria: string | null; unidade_uso: string }[] ?? [])
  const ids = insumos.map((i) => i.id)

  // Quais já têm custo (preço) — para marcar/filtrar
  const custosRes = ids.length > 0
    ? await supabase.from('vw_insumo_custo_atual').select('insumo_id, custo_uso').in('insumo_id', ids)
    : { data: [] }
  const comCusto = new Map<string, number>(
    ((custosRes.data as { insumo_id: string; custo_uso: number | null }[] ?? [])
      .filter((c) => c.custo_uso && c.custo_uso > 0)
      .map((c) => [c.insumo_id, c.custo_uso as number]))
  )

  const dados: InsumoParaPrecificar[] = insumos.map((i) => ({
    id: i.id,
    nome: i.nome,
    categoria: i.categoria,
    unidade_uso: i.unidade_uso,
    custoAtual: comCusto.get(i.id) ?? null,
  }))

  const categorias = [...new Set(insumos.map((i) => i.categoria).filter((c): c is string => !!c))].sort()

  if (insumos.length === 0) notFound()

  return (
    <div>
      <Link
        href="/dashboard/insumos"
        className="inline-flex items-center gap-1.5 text-secondary hover:text-accent-primary text-sm mb-6 transition-all hover:-translate-x-0.5"
      >
        <ArrowLeft size={15} />
        Insumos
      </Link>
      <PrecificarLoteGrid insumos={dados} categorias={categorias} />
    </div>
  )
}
