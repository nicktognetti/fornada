'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { temAcesso } from '@/app/lib/authz'
import { hojeBR } from '@/lib/format'
import type {
  ActionResult, Compra, NovaCompraInput, InsumoParaCompra,
} from '@/app/dashboard/transferencias/receber/types'

export async function criarCompraAction(input: NovaCompraInput): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  // A unidade vem do cliente: sem esta checagem, bastava trocar o id no
  // payload para lançar compra na loja do vizinho (a RLS legada não pegava).
  if (!(await temAcesso(user.id, ['receber', 'transferencias'], { unidadeId: input.unidade_id })))
    return { error: 'Sem permissão para registrar compras nesta loja' }

  if (!input.fornecedor.trim()) return { error: 'Fornecedor obrigatório' }
  if (!input.data_compra)       return { error: 'Data obrigatória' }
  if (input.valor_total <= 0)   return { error: 'Valor deve ser maior que zero' }

  const itens = (input.itens ?? []).filter((i) => i.descricao.trim())
  for (const [i, item] of itens.entries()) {
    const linha = `Item ${i + 1}${item.descricao.trim() ? ` (${item.descricao.trim()})` : ''}`
    if (!Number.isFinite(item.quantidade) || item.quantidade <= 0)
      return { error: `${linha}: informe uma quantidade maior que zero` }
    if (!Number.isFinite(item.preco_unitario) || item.preco_unitario < 0)
      return { error: `${linha}: preço inválido` }
  }

  const { data: compra, error } = await supabase.from('compra').insert({
    unidade_id:  input.unidade_id,
    fornecedor:  input.fornecedor.trim(),
    data_compra: input.data_compra,
    valor_total: input.valor_total,
    observacao:  input.observacao?.trim() || null,
  }).select('id').single()

  if (error || !compra) return { error: 'Erro ao registrar compra: ' + (error?.message ?? '') }

  if (itens.length > 0) {
    // subtotal é coluna GERADA (quantidade * preco_unitario) — não se insere.
    const { error: eItens } = await supabase.from('compra_item').insert(
      itens.map((i) => ({
        compra_id: compra.id,
        insumo_id: i.insumo_id,
        descricao: i.descricao.trim(),
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario,
      }))
    )
    if (eItens) return { error: 'Compra registrada, mas erro nos itens: ' + eItens.message }

    const origem = `Compra ${input.fornecedor.trim()} · ${input.data_compra}`
    const aviso = await atualizarCustosDosInsumos(supabase, itens, origem)
    if (aviso) {
      revalidatePath('/dashboard/transferencias/receber')
      return { success: true, aviso }
    }
  }

  revalidatePath('/dashboard/transferencias/receber')
  revalidatePath('/dashboard/insumos')
  return { success: true }
}

/**
 * Reajusta o custo dos insumos marcados, a partir do preço pago na compra.
 *
 * O `insumo_preco` guarda o par (preço da embalagem, quanto de uso ela rende).
 * A compra informa só o preço — o RENDIMENTO é característica do insumo, não
 * da nota. Então reaproveitamos `qtd_uso_por_compra` e `unidade_compra` do
 * preço vigente e trocamos apenas o valor: é exatamente um reajuste ("mesmo
 * saco de 5 kg, agora mais caro").
 *
 * Insumo que nunca teve preço não tem rendimento conhecido — seria preciso
 * adivinhar quantos gramas rende a embalagem, então ele é pulado com aviso.
 * Histórico é INSERT (nunca UPDATE), preservando a trilha; a origem fica em
 * `nota_fiscal_ref` para dar para saber depois se o preço veio de uma compra
 * ou foi digitado à mão.
 */
async function atualizarCustosDosInsumos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itens: NonNullable<NovaCompraInput['itens']>,
  origem: string,
): Promise<string | undefined> {
  const paraAtualizar = itens.filter((i) => i.atualizar_custo && i.insumo_id)
  if (paraAtualizar.length === 0) return undefined

  const ids = paraAtualizar.map((i) => i.insumo_id!) as string[]
  const { data: precos } = await supabase
    .from('insumo_preco')
    .select('insumo_id, preco_compra, qtd_uso_por_compra, unidade_compra, vigente_desde')
    .in('insumo_id', ids)
    .order('vigente_desde', { ascending: false })

  // Vigente = o mais recente por insumo.
  const vigentePorInsumo = new Map<string, { qtd_uso_por_compra: number; unidade_compra: string }>()
  for (const p of (precos ?? []) as { insumo_id: string; qtd_uso_por_compra: number; unidade_compra: string }[]) {
    if (!vigentePorInsumo.has(p.insumo_id)) {
      vigentePorInsumo.set(p.insumo_id, {
        qtd_uso_por_compra: p.qtd_uso_por_compra,
        unidade_compra: p.unidade_compra,
      })
    }
  }

  const novos: Record<string, unknown>[] = []
  const semReferencia: string[] = []
  for (const item of paraAtualizar) {
    const vigente = vigentePorInsumo.get(item.insumo_id!)
    if (!vigente || !(vigente.qtd_uso_por_compra > 0)) {
      semReferencia.push(item.descricao.trim())
      continue
    }
    novos.push({
      insumo_id: item.insumo_id,
      preco_compra: item.preco_unitario,
      qtd_uso_por_compra: vigente.qtd_uso_por_compra,
      unidade_compra: vigente.unidade_compra,
      vigente_desde: hojeBR(),
      nota_fiscal_ref: origem.slice(0, 200),
    })
  }

  if (novos.length > 0) {
    const { error } = await supabase.from('insumo_preco').insert(novos)
    if (error) return `Compra salva, mas os custos não foram atualizados: ${error.message}`
    revalidatePath('/dashboard/insumos')
    revalidatePath('/dashboard/painel')
  }

  if (semReferencia.length > 0) {
    return `Custo atualizado em ${novos.length} insumo(s). Sem histórico de preço para calcular o rendimento da embalagem: ${semReferencia.join(', ')} — cadastre o primeiro preço na tela de Insumos.`
  }
  return undefined
}

export async function listarComprasAction(unidadeId: string): Promise<Compra[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('compra')
    .select('*')
    .eq('unidade_id', unidadeId)
    .order('data_compra', { ascending: false })
    .limit(50)

  return (data ?? []) as Compra[]
}

/** Insumos da loja com o custo vigente — para montar os itens da compra. */
export async function getInsumosParaCompra(unidadeId: string): Promise<InsumoParaCompra[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: insumos } = await supabase
    .from('insumo')
    .select('id, nome, unidade_uso')
    .eq('unidade_id', unidadeId)
    .eq('ativo', true)
    .order('nome')
  if (!insumos || insumos.length === 0) return []

  const { data: precos } = await supabase
    .from('insumo_preco')
    .select('insumo_id, preco_compra, qtd_uso_por_compra, unidade_compra, vigente_desde')
    .in('insumo_id', insumos.map((i: { id: string }) => i.id))
    .order('vigente_desde', { ascending: false })

  const vigente = new Map<string, { preco_compra: number; qtd_uso_por_compra: number; unidade_compra: string }>()
  for (const p of (precos ?? []) as { insumo_id: string; preco_compra: number; qtd_uso_por_compra: number; unidade_compra: string }[]) {
    if (!vigente.has(p.insumo_id)) vigente.set(p.insumo_id, p)
  }

  return (insumos as { id: string; nome: string; unidade_uso: string }[]).map((i) => {
    const v = vigente.get(i.id)
    return {
      id: i.id,
      nome: i.nome,
      unidade_uso: i.unidade_uso,
      preco_atual: v?.preco_compra ?? null,
      qtd_uso_por_compra: v?.qtd_uso_por_compra ?? null,
      unidade_compra: v?.unidade_compra ?? null,
    }
  })
}
