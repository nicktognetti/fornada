import { Calculator } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { createClient } from '@/lib/supabase/server'
import { SimuladorClient } from './components/simulador-client'
import type { ProdutoRentabilidade } from '@/app/dashboard/painel/types'

function calcStatus(margem: number): ProdutoRentabilidade['status'] {
  if (margem >= 40) return 'lucrativo'
  if (margem >= 20) return 'baixo'
  return 'prejuizo'
}

export default async function SimuladorPage({
  searchParams,
}: {
  searchParams: Promise<{ unidade?: string }>
}) {
  const { unidade: unidadeId } = await searchParams
  const supabase = await createClient()

  let produtosQ = supabase
    .from('produto')
    .select('id, nome, receita_id')
    .eq('ativo', true)
    .order('nome')
  if (unidadeId) produtosQ = produtosQ.eq('unidade_id', unidadeId)

  const [prodRes, custoRes, precoRes] = await Promise.all([
    produtosQ,
    supabase.from('vw_custo_receita').select('id, custo_unitario'),
    supabase.from('produto_preco').select('produto_id, preco_praticado'),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const custoMap = new Map<string, number>(
    (custoRes.data ?? [])
      .filter((r: any) => r.custo_unitario != null)
      .map((r: any) => [r.id as string, r.custo_unitario as number])
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const precoMap = new Map<string, number>(
    (precoRes.data ?? [])
      .filter((r: any) => r.preco_praticado != null)
      .map((r: any) => [r.produto_id as string, r.preco_praticado as number])
  )

  const produtos: ProdutoRentabilidade[] = []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const p of (prodRes.data ?? []) as any[]) {
    const custo = p.receita_id ? (custoMap.get(p.receita_id) ?? 0) : 0
    const preco = precoMap.get(p.id) ?? 0
    if (custo <= 0 || preco <= 0) continue

    const margem = ((preco - custo) / preco) * 100
    const markup = ((preco - custo) / custo) * 100

    produtos.push({
      id: p.id,
      nome: p.nome,
      custo,
      preco,
      margem,
      markup,
      status: calcStatus(margem),
    })
  }

  return (
    <div className="max-w-5xl">
      <PageTitle icon={Calculator} subtitle="Simule o impacto de reajustes antes de decidir">
        Simulador de Preços
      </PageTitle>
      <SimuladorClient produtos={produtos} />
    </div>
  )
}
