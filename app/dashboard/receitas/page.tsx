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

  // A view de custo não traz a foto; buscamos foto_url à parte para a miniatura.
  const [{ data }, { data: fotos }] = await Promise.all([
    query,
    supabase.from('receita').select('id, foto_url').eq('ativo', true).not('foto_url', 'is', null),
  ])
  const fotoPorId = new Map<string, string>(
    ((fotos as { id: string; foto_url: string | null }[]) ?? [])
      .filter((f) => f.foto_url)
      .map((f) => [f.id, f.foto_url as string])
  )

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
    // Demais campos do "caderno" não são exibidos na listagem (a ficha carrega os reais).
    passos: [],
    tempo_preparo_min: null,
    temperatura_forno: null,
    tempo_forno_min: null,
    dificuldade: null,
    foto_url: fotoPorId.get(r.id) ?? null,
  }))

  return (
    <div>
      <PageTitle icon={BookOpen}>Fichas Técnicas</PageTitle>
      <ReceitaList receitas={receitas} />
    </div>
  )
}
