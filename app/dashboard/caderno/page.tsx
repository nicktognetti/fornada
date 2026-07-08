import { createClient } from '@/lib/supabase/server'
import { ChefHat } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { getUnidadePreferida } from '@/app/actions/unidade'
import { CadernoCatalogo, type ReceitaCaderno } from './components/caderno-catalogo'

// Caderno de Receitas — a "capa" do caderno para a produção/confeitaria.
// Lê a receita direta (SEM a view de custo): aqui não existe valor nenhum.
export default async function CadernoPage() {
  const [unidadeId, supabase] = await Promise.all([getUnidadePreferida(), createClient()])

  let query = supabase
    .from('receita')
    .select('id, nome, tipo, rendimento, rendimento_unidade, foto_url, passos, tempo_preparo_min, dificuldade')
    .eq('ativo', true)
    .order('nome')
  if (unidadeId) query = query.eq('unidade_id', unidadeId)

  const { data } = await query
  const receitas = (data as ReceitaCaderno[]) ?? []

  return (
    <div>
      <PageTitle icon={ChefHat}>Caderno de Receitas</PageTitle>
      <CadernoCatalogo receitas={receitas} />
    </div>
  )
}
