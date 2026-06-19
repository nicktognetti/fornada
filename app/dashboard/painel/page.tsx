import { BarChart3 } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { createClient } from '@/lib/supabase/server'
import { PainelClient } from './components/painel-client'
import type { ProdutoRentabilidade, PainelResumo } from './types'

function calcStatus(margem: number): ProdutoRentabilidade['status'] {
  if (margem >= 40) return 'lucrativo'
  if (margem >= 20) return 'baixo'
  return 'prejuizo'
}

export default async function PainelPage({
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

  const sorted = [...produtos].sort((a, b) => b.margem - a.margem)
  const margemMedia = produtos.length
    ? produtos.reduce((s, p) => s + p.margem, 0) / produtos.length
    : 0
  const markupMedio = produtos.length
    ? produtos.reduce((s, p) => s + p.markup, 0) / produtos.length
    : 0
  const precoMedio = produtos.length
    ? produtos.reduce((s, p) => s + p.preco, 0) / produtos.length
    : 0

  const resumo: PainelResumo = {
    margemMedia,
    markupMedio,
    maisLucrativo: sorted[0] ? { nome: sorted[0].nome, margem: sorted[0].margem } : null,
    menosLucrativo: sorted[sorted.length - 1]
      ? { nome: sorted[sorted.length - 1].nome, margem: sorted[sorted.length - 1].margem }
      : null,
    precoMedio,
    totalProdutos: produtos.length,
  }

  return (
    <div className="max-w-5xl">
      <PageTitle icon={BarChart3} subtitle="Rentabilidade e precificação de produtos">
        Painel Financeiro
      </PageTitle>
      <PainelClient produtos={produtos} resumo={resumo} />
    </div>
  )
}
