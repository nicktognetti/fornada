import { Package } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { createClient } from '@/lib/supabase/server'
import { getPainelFinanceiro } from '@/app/actions/painel'
import { getUnidadePreferida } from '@/app/actions/unidade'
import { ProdutoList } from './components/produto-list'

export default async function ProdutosPage() {
  const [unidadeId, supabase] = await Promise.all([
    getUnidadePreferida(),
    createClient(),
  ])

  const [result, unidadesRes, receitasRes] = await Promise.all([
    getPainelFinanceiro(unidadeId ?? undefined),
    supabase.from('unidade').select('id, nome').order('nome'),
    supabase.from('receita').select('id, nome').eq('ativo', true)
      .not('nome', 'like', '- %')
      .not('nome', 'like', '%(sem nome)%')
      .order('nome')
      .limit(500),
  ])

  const produtos = result.data?.fichas ?? []
  const unidades = (unidadesRes.data ?? []) as { id: string; nome: string }[]
  const receitas = (receitasRes.data ?? []) as { id: string; nome: string }[]

  return (
    <div className="max-w-4xl">
      <PageTitle icon={Package} subtitle="Gerencie produtos fabricados e de revenda">
        Produtos
      </PageTitle>

      <ProdutoList
        produtos={produtos}
        unidades={unidades}
        receitas={receitas}
      />
    </div>
  )
}
