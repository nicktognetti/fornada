import { BarChart3 } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { getPainelFinanceiro, getDespesasFixas } from '@/app/actions/painel'
import { getUnidadePreferida } from '@/app/actions/unidade'
import { getMetaFaturamento } from '@/app/actions/empresa'
import { PainelTipoFiltro } from './components/painel-tipo-filtro'
import { PainelClient } from './components/painel-client'

export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>
}) {
  const [unidadeId, { tipo }, meta, despesasResult] = await Promise.all([
    getUnidadePreferida(),
    searchParams,
    getMetaFaturamento(),
    getDespesasFixas(),
  ])

  const tipoProduto = (tipo === 'produzido' || tipo === 'revenda') ? tipo : 'todos'

  const result = await getPainelFinanceiro(
    unidadeId ?? undefined,
    tipoProduto as 'produzido' | 'revenda' | 'todos',
  )
  const fichas = result.data?.fichas ?? []
  const indicadores = result.data?.indicadores ?? {
    total_produtos: 0, produtos_com_preco: 0, produtos_sem_preco: 0,
    produtos_margem_negativa: 0, margem_media_percentual: 0,
    margem_ponderada_percentual: 0,
    valor_portfolio: 0, custo_total_geral: 0, margem_total_rs: 0,
  }
  const despesas = despesasResult.data ?? []

  return (
    <div className="max-w-5xl space-y-6">
      <PageTitle icon={BarChart3} subtitle="Análise de margem por produto">
        Painel Financeiro
      </PageTitle>

      <PainelTipoFiltro tipoAtual={tipoProduto} />

      <PainelClient fichas={fichas} indicadores={indicadores} meta={meta} despesas={despesas} />
    </div>
  )
}
