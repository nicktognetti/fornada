import { Calculator } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { getPainelFinanceiro, getDespesasFixas } from '@/app/actions/painel'
import { getUnidadePreferida } from '@/app/actions/unidade'
import { SimuladorClient } from './components/simulador-client'
import type { ProdutoRentabilidade } from '@/app/dashboard/painel/types'

function calcStatus(margem: number): ProdutoRentabilidade['status'] {
  if (margem >= 40) return 'lucrativo'
  if (margem >= 20) return 'baixo'
  return 'prejuizo'
}

export default async function SimuladorPage() {
  const unidadeId = await getUnidadePreferida()
  const [result, despesasResult] = await Promise.all([
    getPainelFinanceiro(unidadeId ?? undefined),
    getDespesasFixas(),
  ])

  const fichas = result.data?.fichas ?? []
  const totalDespesas = (despesasResult.data ?? []).reduce((s, d) => s + d.valor, 0)

  const produtos: ProdutoRentabilidade[] = fichas
    .filter((p) => p.custo_total > 0 && p.preco_venda > 0)
    .map((p) => ({
      id:     p.produto_id,
      nome:   p.produto_nome,
      custo:  p.custo_total,
      preco:  p.preco_venda,
      margem: p.margem_percentual,
      markup: p.markup_percentual,
      status: calcStatus(p.margem_percentual),
    }))

  return (
    <div className="max-w-5xl">
      <PageTitle icon={Calculator} subtitle="Simule o impacto de reajustes antes de decidir">
        Simulador de Preços
      </PageTitle>
      <SimuladorClient produtos={produtos} totalDespesas={totalDespesas} />
    </div>
  )
}
