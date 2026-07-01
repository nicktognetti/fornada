import { Package } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { createClient } from '@/lib/supabase/server'
import { getPainelFinanceiro } from '@/app/actions/painel'
import { getUnidadePreferida } from '@/app/actions/unidade'
import { getConfigAction } from '@/app/actions/config'
import { LOCAIS_CONFIG_KEY, LOCAIS_PADRAO } from '@/app/lib/locais'
import { ProdutoList } from './components/produto-list'

export default async function ProdutosPage() {
  const [unidadeId, supabase] = await Promise.all([
    getUnidadePreferida(),
    createClient(),
  ])

  const [result, unidadesRes, receitasRes, locaisEncomendaRes] = await Promise.all([
    getPainelFinanceiro(unidadeId ?? undefined),
    supabase.from('unidade').select('id, nome').order('nome'),
    supabase.from('receita').select('id, nome').eq('ativo', true)
      .not('nome', 'like', '- %')
      .not('nome', 'like', '%(sem nome)%')
      .order('nome')
      .limit(500),
    getConfigAction<string[]>(LOCAIS_CONFIG_KEY),
  ])

  // Local (setor) atual de cada produto — não vem na view financeira.
  let localQuery = supabase.from('produto').select('id, local')
  if (unidadeId) localQuery = localQuery.eq('unidade_id', unidadeId)
  const { data: locaisData } = await localQuery
  const localMap: Record<string, string | null> = Object.fromEntries((locaisData ?? []).map((p: { id: string; local: string | null }) => [p.id, p.local]))

  const produtos = result.data?.fichas ?? []
  const unidades = (unidadesRes.data ?? []) as { id: string; nome: string }[]
  const receitas = (receitasRes.data ?? []) as { id: string; nome: string }[]
  const locais = locaisEncomendaRes.data ?? LOCAIS_PADRAO

  return (
    <div className="max-w-4xl">
      <PageTitle icon={Package} subtitle="Gerencie produtos fabricados e de revenda">
        Produtos
      </PageTitle>

      <ProdutoList
        produtos={produtos}
        unidades={unidades}
        receitas={receitas}
        locais={locais}
        localMap={localMap}
      />
    </div>
  )
}
