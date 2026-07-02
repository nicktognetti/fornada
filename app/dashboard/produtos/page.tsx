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
    supabase.from('vw_custo_receita').select('id, nome, custo_unitario, rendimento_unidade').eq('ativo', true)
      .not('nome', 'like', '- %')
      .not('nome', 'like', '%(sem nome)%')
      .order('nome')
      .limit(500),
    getConfigAction<string[]>(LOCAIS_CONFIG_KEY),
  ])

  // Local (setor) + ficha ligada de cada produto — não vêm na view financeira.
  let localQuery = supabase.from('produto').select('id, local, receita_id').eq('ativo', true)
  if (unidadeId) localQuery = localQuery.eq('unidade_id', unidadeId)
  const { data: locaisData } = await localQuery
  const localMap: Record<string, string | null> = Object.fromEntries((locaisData ?? []).map((p: { id: string; local: string | null }) => [p.id, p.local]))
  // Fichas que já viraram produto nesta loja — não devem reaparecer no seletor de "Fabricado".
  const receitasUsadas = new Set((locaisData ?? []).map((p: { receita_id: string | null }) => p.receita_id).filter(Boolean))

  const produtos = result.data?.fichas ?? []
  const unidades = (unidadesRes.data ?? []) as { id: string; nome: string }[]
  type FichaOpt = { id: string; nome: string; custo_unitario: number | null; rendimento_unidade: string | null }
  const receitas = ((receitasRes.data ?? []) as FichaOpt[]).filter((r) => !receitasUsadas.has(r.id))
  const locais = locaisEncomendaRes.data ?? LOCAIS_PADRAO

  return (
    <div className="max-w-4xl">
      <PageTitle icon={Package} subtitle="Gerencie produtos fabricados e de revenda">
        Produtos
      </PageTitle>

      <ProdutoList
        produtos={produtos}
        unidades={unidades}
        unidadeAtual={unidadeId ?? null}
        receitas={receitas}
        locais={locais}
        localMap={localMap}
      />
    </div>
  )
}
