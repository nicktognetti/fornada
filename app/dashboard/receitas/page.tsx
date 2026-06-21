import { createClient } from '@/lib/supabase/server'
import { BookOpen } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { ReceitaList } from './components/receita-list'
import { getUnidadePreferida } from '@/app/actions/unidade'
import type { ReceitaComCusto, ReceitaTipo } from './types'

export default async function ReceitasPage() {
  const [unidadeId, supabase] = await Promise.all([getUnidadePreferida(), createClient()])

  let query = supabase.from('vw_custo_receita').select('*').order('nome')
  if (unidadeId) query = query.eq('unidade_id', unidadeId)

  const { data } = await query

  type ViewRow = {
    id: string; empresa_id: string; unidade_id: string; nome: string; tipo: ReceitaTipo
    rendimento: number; rendimento_unidade: string
    custo_total: number | null; custo_unitario: number | null
  }
  const receitas: ReceitaComCusto[] = ((data as ViewRow[]) ?? []).map((r) => ({
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
