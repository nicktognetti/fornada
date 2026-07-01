'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { temAcesso } from '@/app/lib/authz'
import { getUnidadeAutorizada, getUnidadePreferida } from '@/app/actions/unidade'
import { getPainelFinanceiro } from '@/app/actions/painel'
import { subtotalItem, totalPedido } from '@/lib/pedido-calc'
import { upsertCliente } from '@/app/lib/cliente-upsert'

type ActionResult<T = void> = T extends void
  ? { error?: string; success?: boolean }
  : { error?: string; data?: T }

export type ProdutoOrcamento = { id: string; nome: string; categoria: string | null; preco_base: number }

export type OrcamentoItemInput = {
  produto_id: string | null
  descricao: string
  quantidade: number
  preco_unitario: number
}

export type OrcamentoStatus = 'aguardando' | 'aprovado' | 'recusado'
const ORCAMENTO_STATUS: OrcamentoStatus[] = ['aguardando', 'aprovado', 'recusado']

export type OrcamentoListItem = {
  id: string
  numero: number
  cliente_nome: string
  total: number
  validade_dias: number
  status: OrcamentoStatus
  created_at: string
}

export type OrcamentoDetalhe = {
  id: string
  numero: number
  cliente_nome: string
  cliente_contato: string | null
  validade_dias: number
  status: OrcamentoStatus
  observacao: string | null
  total: number
  created_at: string
  unidade_nome: string | null
  itens: { id: string; produto_id: string | null; descricao: string; quantidade: number; preco_unitario: number; subtotal: number }[]
}

async function getEmpresaId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string | null> {
  const { data } = await supabase.from('usuario_empresa').select('empresa_id').eq('user_id', userId).maybeSingle()
  return data?.empresa_id ?? null
}

// Unidade de escrita: a autorizada (cookie validado) se pertencer à empresa, senão a 1ª ativa.
async function getUnidadeEscrita(supabase: Awaited<ReturnType<typeof createClient>>, empresaId: string): Promise<string | null> {
  const pref = await getUnidadeAutorizada()
  if (pref) {
    const { data } = await supabase.from('unidade').select('id').eq('id', pref).eq('empresa_id', empresaId).maybeSingle()
    if (data) return data.id
  }
  const { data } = await supabase.from('unidade').select('id').eq('empresa_id', empresaId).eq('ativo', true).order('nome').limit(1).maybeSingle()
  return data?.id ?? null
}

// ── Produtos para montar o orçamento (com preço de venda como base) ─────────────
export async function getProdutosParaOrcamento(): Promise<ProdutoOrcamento[]> {
  const unidadeId = await getUnidadePreferida()
  const r = await getPainelFinanceiro(unidadeId ?? undefined)
  return (r.data?.fichas ?? []).map((p) => ({
    id: p.produto_id, nome: p.produto_nome, categoria: p.categoria, preco_base: p.preco_venda,
  }))
}

// ── Criar orçamento ─────────────────────────────────────────────────────────────
export async function criarOrcamento(
  dados: { cliente_nome: string; cliente_contato?: string | null; validade_dias: number; observacao?: string | null },
  itens: OrcamentoItemInput[],
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!dados.cliente_nome.trim()) return { error: 'Informe o nome do cliente' }
  if (itens.length === 0) return { error: 'Adicione ao menos um item' }

  const empresaId = await getEmpresaId(supabase, user.id)
  if (!empresaId) return { error: 'Empresa não encontrada' }
  const unidadeId = await getUnidadeEscrita(supabase, empresaId)
  if (!unidadeId) return { error: 'Unidade não encontrada' }
  if (!(await temAcesso(user.id, ['orcamento'], { unidadeId })))
    return { error: 'Sem permissão para criar orçamentos nesta unidade' }

  const itensCalc = itens
    .filter((i) => i.quantidade > 0 && i.preco_unitario >= 0 && i.descricao.trim())
    .map((i) => ({ ...i, subtotal: subtotalItem(i.quantidade, i.preco_unitario) }))
  if (itensCalc.length === 0) return { error: 'Nenhum item válido' }
  const total = totalPedido(itensCalc.map((i) => ({ quantidade: i.quantidade, precoUnitario: i.preco_unitario })))

  const { data: orc, error: e1 } = await supabase
    .from('orcamento')
    .insert({
      empresa_id: empresaId, unidade_id: unidadeId,
      cliente_nome: dados.cliente_nome.trim(),
      cliente_contato: dados.cliente_contato?.trim() || null,
      validade_dias: dados.validade_dias,
      observacao: dados.observacao?.trim() || null,
      total,
    })
    .select('id').single()
  if (e1 || !orc) return { error: 'Erro ao salvar orçamento: ' + (e1?.message ?? '') }

  const { error: e2 } = await supabase.from('orcamento_item').insert(
    itensCalc.map((i) => ({
      orcamento_id: orc.id, produto_id: i.produto_id,
      descricao: i.descricao.trim(), quantidade: i.quantidade,
      preco_unitario: i.preco_unitario, subtotal: i.subtotal,
    }))
  )
  if (e2) return { error: 'Orçamento criado, mas erro nos itens: ' + e2.message }

  await upsertCliente(supabase, empresaId, unidadeId, dados.cliente_nome, dados.cliente_contato)

  revalidatePath('/dashboard/orcamentos')
  return { data: { id: orc.id } }
}

// ── Editar orçamento (atualiza campos + substitui itens) ────────────────────────
export async function atualizarOrcamento(
  id: string,
  dados: { cliente_nome: string; cliente_contato?: string | null; validade_dias: number; observacao?: string | null },
  itens: OrcamentoItemInput[],
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!dados.cliente_nome.trim()) return { error: 'Informe o nome do cliente' }
  if (itens.length === 0) return { error: 'Adicione ao menos um item' }
  if (!(await temAcesso(user.id, ['orcamento']))) return { error: 'Sem permissão' }

  const { data: atual } = await supabase.from('orcamento').select('empresa_id, unidade_id').eq('id', id).maybeSingle()
  if (!atual) return { error: 'Orçamento não encontrado' }

  const itensCalc = itens
    .filter((i) => i.quantidade > 0 && i.preco_unitario >= 0 && i.descricao.trim())
    .map((i) => ({ ...i, subtotal: subtotalItem(i.quantidade, i.preco_unitario) }))
  if (itensCalc.length === 0) return { error: 'Nenhum item válido' }
  const total = totalPedido(itensCalc.map((i) => ({ quantidade: i.quantidade, precoUnitario: i.preco_unitario })))

  const { error: e1 } = await supabase.from('orcamento').update({
    cliente_nome: dados.cliente_nome.trim(),
    cliente_contato: dados.cliente_contato?.trim() || null,
    validade_dias: dados.validade_dias,
    observacao: dados.observacao?.trim() || null,
    total,
  }).eq('id', id)
  if (e1) return { error: 'Erro ao salvar: ' + e1.message }

  const { error: eDel } = await supabase.from('orcamento_item').delete().eq('orcamento_id', id)
  if (eDel) return { error: 'Erro ao atualizar itens: ' + eDel.message }
  const { error: e2 } = await supabase.from('orcamento_item').insert(
    itensCalc.map((i) => ({
      orcamento_id: id, produto_id: i.produto_id,
      descricao: i.descricao.trim(), quantidade: i.quantidade,
      preco_unitario: i.preco_unitario, subtotal: i.subtotal,
    }))
  )
  if (e2) return { error: 'Erro ao gravar itens: ' + e2.message }

  await upsertCliente(supabase, atual.empresa_id as string, atual.unidade_id as string, dados.cliente_nome, dados.cliente_contato)

  revalidatePath('/dashboard/orcamentos')
  revalidatePath(`/dashboard/orcamentos/${id}`)
  return { data: { id } }
}

// ── Listar orçamentos (da unidade atual; busca por cliente) ─────────────────────
export async function listarOrcamentos(busca?: string): Promise<ActionResult<OrcamentoListItem[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const unidadeId = await getUnidadePreferida()
  let q = supabase.from('orcamento').select('id, numero, cliente_nome, total, validade_dias, status, created_at').order('created_at', { ascending: false })
  if (unidadeId) q = q.eq('unidade_id', unidadeId)
  if (busca && busca.trim()) q = q.ilike('cliente_nome', `%${busca.trim()}%`)
  const { data, error } = await q
  if (error) return { error: error.message }
  return { data: (data as OrcamentoListItem[]) ?? [] }
}

// ── Buscar um orçamento (com itens) ─────────────────────────────────────────────
export async function getOrcamento(id: string): Promise<ActionResult<OrcamentoDetalhe>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const [orcRes, itensRes] = await Promise.all([
    supabase.from('orcamento').select('*, unidade:unidade_id ( nome )').eq('id', id).maybeSingle(),
    supabase.from('orcamento_item').select('id, produto_id, descricao, quantidade, preco_unitario, subtotal').eq('orcamento_id', id),
  ])
  const orc = orcRes.data as (Record<string, unknown> & { unidade: { nome: string } | null }) | null
  if (!orc) return { error: 'Orçamento não encontrado' }

  return {
    data: {
      id: orc.id as string,
      numero: orc.numero as number,
      cliente_nome: orc.cliente_nome as string,
      cliente_contato: (orc.cliente_contato as string | null) ?? null,
      validade_dias: orc.validade_dias as number,
      status: orc.status as OrcamentoStatus,
      observacao: (orc.observacao as string | null) ?? null,
      total: orc.total as number,
      created_at: orc.created_at as string,
      unidade_nome: orc.unidade?.nome ?? null,
      itens: (itensRes.data as OrcamentoDetalhe['itens']) ?? [],
    },
  }
}

// ── Atualizar status do orçamento ───────────────────────────────────────────────
export async function atualizarStatusOrcamento(id: string, status: OrcamentoStatus): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!ORCAMENTO_STATUS.includes(status)) return { error: 'Status inválido' }
  if (!(await temAcesso(user.id, ['orcamento']))) return { error: 'Sem permissão' }

  const { error } = await supabase.from('orcamento').update({ status }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/orcamentos')
  revalidatePath(`/dashboard/orcamentos/${id}`)
  return { success: true }
}

// ── Excluir orçamento ───────────────────────────────────────────────────────────
export async function excluirOrcamento(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!(await temAcesso(user.id, ['orcamento']))) return { error: 'Sem permissão' }
  const { error } = await supabase.from('orcamento').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/orcamentos')
  return { success: true }
}
