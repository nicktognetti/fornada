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

  // A view de custo não traz foto nem o status de revisão; buscamos à parte.
  const [{ data }, { data: meta }] = await Promise.all([
    query,
    supabase.from('receita').select('id, foto_url, revisao_pendente, categoria').eq('ativo', true),
  ])
  const metaRows = (meta as { id: string; foto_url: string | null; revisao_pendente: boolean; categoria: string | null }[]) ?? []
  const fotoPorId = new Map<string, string>(
    metaRows.filter((f) => f.foto_url).map((f) => [f.id, f.foto_url as string])
  )
  const pendentePorId = new Map<string, boolean>(metaRows.map((f) => [f.id, !!f.revisao_pendente]))
  const categoriaPorId = new Map<string, string | null>(metaRows.map((f) => [f.id, f.categoria]))

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
    categoria: categoriaPorId.get(r.id) ?? null,
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
    revisao_pendente: pendentePorId.get(r.id) ?? false,
  }))

  // Receitas aguardando revisão (criadas/alteradas pela produção) sobem para o topo.
  receitas.sort((a, b) => Number(b.revisao_pendente) - Number(a.revisao_pendente))

  return (
    <div>
      <PageTitle icon={BookOpen}>Fichas Técnicas</PageTitle>
      <ReceitaList receitas={receitas} />
    </div>
  )
}
