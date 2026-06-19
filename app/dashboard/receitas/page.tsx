import { createClient } from '@/lib/supabase/server'
import { BookOpen } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { ReceitaList } from './components/receita-list'
import type { ReceitaComCusto } from './types'

export default async function ReceitasPage({
  searchParams,
}: {
  searchParams: Promise<{ unidade?: string }>
}) {
  const { unidade: unidadeId } = await searchParams
  const supabase = await createClient()

  let query = supabase.from('vw_custo_receita').select('*').order('nome')
  if (unidadeId) query = query.eq('unidade_id', unidadeId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await query

  const receitas: ReceitaComCusto[] = (data ?? []).map((r: any) => ({
    id: r.id,
    empresa_id: r.empresa_id,
    unidade_id: r.unidade_id,
    nome: r.nome,
    tipo: r.tipo,
    rendimento: r.rendimento,
    rendimento_unidade: r.rendimento_unidade,
    custo_total: r.custo_total,
    custo_unitario: r.custo_unitario,
    ativo: true,
    observacao: null,
  }))

  return (
    <div>
      <PageTitle icon={BookOpen}>Fichas Técnicas</PageTitle>
      <ReceitaList receitas={receitas} />
    </div>
  )
}
