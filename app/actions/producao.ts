'use server'

// Plano de produção do dia: o que a cozinha precisa FAZER numa data, somado
// por setor. É uma leitura derivada das encomendas — não guarda estado próprio.
//
// Por que existe: a lista de encomendas responde "quais pedidos temos"; a
// produção precisa da pergunta inversa — "quantos quilos de pão de queijo eu
// faço hoje, e em qual bancada". Antes isso era somado no papel, encomenda por
// encomenda.

import { createClient } from '@/lib/supabase/server'
import { temAcesso } from '@/app/lib/authz'
import { getUnidadePreferida } from '@/app/actions/unidade'
import { unidadeGrande } from '@/lib/format'
import { agruparParaProducao, type LinhaItem, type GrupoProducao } from '@/lib/producao-agrupar'
import type { ActionResult } from '@/lib/action-result'

/** Status que ainda demandam produção. 'pronto'/'entregue' já foram feitos. */
const STATUS_A_PRODUZIR = ['pendente', 'em_producao'] as const

export type PlanoProducao = {
  data: string
  grupos: GrupoProducao[]
  /** Encomendas consideradas (pendente + em produção) nesta data. */
  totalEncomendas: number
  /** Já prontas/entregues nesta data — fora do plano, mas bom saber que existem. */
  jaProntas: number
}

export async function getPlanoProducao(data: string): Promise<ActionResult<PlanoProducao>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!(await temAcesso(user.id, ['encomenda'], { nivel: 'leitura' })))
    return { error: 'Sem permissão para ver as encomendas' }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { error: 'Data inválida' }

  const unidadeId = await getUnidadePreferida()

  // Encomendas da data (RLS por loja já filtra; o .eq é o escopo da loja ativa)
  let q = supabase
    .from('encomenda')
    .select('id, status')
    .eq('data_entrega', data)
  if (unidadeId) q = q.eq('unidade_id', unidadeId)
  const { data: encs, error } = await q
  if (error) return { error: error.message }

  const todas = (encs ?? []) as { id: string; status: string }[]
  const aProduzir = todas.filter((e) => (STATUS_A_PRODUZIR as readonly string[]).includes(e.status))
  const jaProntas = todas.filter((e) => e.status === 'pronto' || e.status === 'entregue').length

  if (aProduzir.length === 0) {
    return { data: { data, grupos: [], totalEncomendas: 0, jaProntas } }
  }

  const { data: itens, error: eItens } = await supabase
    .from('encomenda_item')
    .select('encomenda_id, produto_id, descricao, quantidade, observacao, local')
    .in('encomenda_id', aProduzir.map((e) => e.id))
  if (eItens) return { error: eItens.message }

  const linhas = (itens ?? []) as LinhaItem[]

  // Unidade de venda (kg/L/un) por produto — não vive no item, vem da ficha.
  const produtoIds = [...new Set(linhas.map((i) => i.produto_id).filter((x): x is string => !!x))]
  const unidadePorProduto = new Map<string, string | null>()
  if (produtoIds.length > 0) {
    const { data: prods } = await supabase
      .from('produto')
      .select('id, receita:receita_id ( rendimento_unidade )')
      .in('id', produtoIds)
    for (const p of (prods ?? []) as { id: string; receita: { rendimento_unidade: string | null } | { rendimento_unidade: string | null }[] | null }[]) {
      const rec = Array.isArray(p.receita) ? p.receita[0] : p.receita
      unidadePorProduto.set(p.id, rec?.rendimento_unidade ? unidadeGrande(rec.rendimento_unidade) : null)
    }
  }

  // Agrupamento em lib/producao-agrupar.ts (puro e testado).
  const grupos = agruparParaProducao(linhas, unidadePorProduto)

  return { data: { data, grupos, totalEncomendas: aProduzir.length, jaProntas } }
}
