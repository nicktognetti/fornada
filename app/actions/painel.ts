'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ProdutoRentabilidade, PainelResumo } from '@/app/dashboard/painel/types'

type ActionResult = { error?: string; success?: boolean }

function calcStatus(margem: number): ProdutoRentabilidade['status'] {
  if (margem >= 40) return 'lucrativo'
  if (margem >= 20) return 'baixo'
  return 'prejuizo'
}

export async function getPainelDataAction(unidadeId?: string): Promise<{
  produtos: ProdutoRentabilidade[]
  resumo: PainelResumo
}> {
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

  type CustoRow  = { id: string; custo_unitario: number | null }
  type PrecoRow  = { produto_id: string; preco_praticado: number | null }
  type ProdRow   = { id: string; nome: string; receita_id: string | null }

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

  // Resumo
  const comDados = produtos.filter((p) => p.preco > 0)
  const margemMedia = comDados.length
    ? comDados.reduce((s, p) => s + p.margem, 0) / comDados.length
    : 0
  const markupMedio = comDados.length
    ? comDados.reduce((s, p) => s + p.markup, 0) / comDados.length
    : 0
  const precoMedio = comDados.length
    ? comDados.reduce((s, p) => s + p.preco, 0) / comDados.length
    : 0

  const sorted = [...produtos].sort((a, b) => b.margem - a.margem)
  const maisLucrativo = sorted[0]
    ? { nome: sorted[0].nome, margem: sorted[0].margem }
    : null
  const menosLucrativo = sorted[sorted.length - 1]
    ? { nome: sorted[sorted.length - 1].nome, margem: sorted[sorted.length - 1].margem }
    : null

  return {
    produtos,
    resumo: {
      margemMedia,
      markupMedio,
      maisLucrativo,
      menosLucrativo,
      precoMedio,
      totalProdutos: produtos.length,
    },
  }
}

export async function aplicarPrecoAction(
  produtoId: string,
  novoPreco: number,
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (novoPreco <= 0) return { error: 'Preço deve ser maior que zero' }

  // Upsert: atualiza se existe, insere se não existe
  const { error } = await supabase
    .from('produto_preco')
    .upsert(
      { produto_id: produtoId, preco_praticado: novoPreco },
      { onConflict: 'produto_id' }
    )

  if (error) return { error: 'Erro ao salvar preço: ' + error.message }

  revalidatePath('/dashboard/painel')
  revalidatePath('/dashboard/precos')
  return { success: true }
}
