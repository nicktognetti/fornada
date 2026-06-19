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

  type CustoRow = { id: string; custo_unitario: number | null }
  type PrecoRow = { produto_id: string; preco_praticado: number | null }
  type ProdRow  = { id: string; nome: string; receita_id: string | null }

  const custoMap = new Map<string, number>(
    (custoRes.data as CustoRow[] ?? [])
      .filter((r) => r.custo_unitario != null)
      .map((r) => [r.id, r.custo_unitario as number])
  )
  const precoMap = new Map<string, number>(
    (precoRes.data as PrecoRow[] ?? [])
      .filter((r) => r.preco_praticado != null)
      .map((r) => [r.produto_id, r.preco_praticado as number])
  )

  const produtos: ProdutoRentabilidade[] = []

  for (const p of (prodRes.data as ProdRow[] ?? [])) {
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
