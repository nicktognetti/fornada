'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { temAcesso } from '@/app/lib/authz'
import { getUnidadeAutorizada, getUnidadePreferida } from '@/app/actions/unidade'
import { subtotalItem, totalPedido } from '@/lib/pedido-calc'
import { upsertCliente } from '@/app/lib/cliente-upsert'
import { unidadeGrande } from '@/lib/format'

type ActionResult<T = void> = T extends void
  ? { error?: string; success?: boolean }
  : { error?: string; data?: T }

export type EncomendaStatus = 'pendente' | 'em_producao' | 'pronto' | 'entregue' | 'cancelada'
const ENCOMENDA_STATUS: EncomendaStatus[] = ['pendente', 'em_producao', 'pronto', 'entregue', 'cancelada']

export type EncomendaItemInput = {
  produto_id: string | null
  descricao: string
  quantidade: number
  preco_unitario: number
  observacao: string | null
  local: string | null
}

export type EncomendaDados = {
  cliente_nome: string
  cliente_contato?: string | null
  data_entrega: string      // YYYY-MM-DD
  hora_entrega?: string | null  // HH:MM
  com_valor: boolean
  rastrear_status: boolean  // acompanhar fluxo de produção
  observacao?: string | null
}

export type EncomendaStatusEvento = { status: EncomendaStatus; changed_at: string }

export type EncomendaListItem = {
  id: string
  numero: number
  cliente_nome: string
  data_entrega: string
  hora_entrega: string | null
  status: EncomendaStatus
  com_valor: boolean
  total: number
}

export type EncomendaDetalhe = EncomendaListItem & {
  cliente_contato: string | null
  observacao: string | null
  created_at: string
  unidade_nome: string | null
  unidade_documento: string | null
  rastrear_status: boolean
  historico: EncomendaStatusEvento[]
  /** true se o usuário pode ver valores (nível admin na tela encomenda). Produção não vê. */
  podeVerValores: boolean
  itens: { id: string; produto_id: string | null; descricao: string; quantidade: number; preco_unitario: number; subtotal: number; observacao: string | null; local: string | null; unidade: string | null }[]
}

async function getEmpresaId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string | null> {
  const { data } = await supabase.from('usuario_empresa').select('empresa_id').eq('user_id', userId).maybeSingle()
  return data?.empresa_id ?? null
}

async function getUnidadeEscrita(supabase: Awaited<ReturnType<typeof createClient>>, empresaId: string): Promise<string | null> {
  const pref = await getUnidadeAutorizada()
  if (pref) {
    const { data } = await supabase.from('unidade').select('id').eq('id', pref).eq('empresa_id', empresaId).maybeSingle()
    if (data) return data.id
  }
  const { data } = await supabase.from('unidade').select('id').eq('empresa_id', empresaId).eq('ativo', true).order('nome').limit(1).maybeSingle()
  return data?.id ?? null
}

// ── Criar encomenda ─────────────────────────────────────────────────────────────
export async function criarEncomenda(
  dados: EncomendaDados,
  itens: EncomendaItemInput[],
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!dados.cliente_nome.trim()) return { error: 'Informe o nome do cliente' }
  if (!dados.data_entrega) return { error: 'Informe a data de entrega' }
  if (!dados.hora_entrega) return { error: 'Informe a hora de entrega' }
  if (itens.length === 0) return { error: 'Adicione ao menos um item' }

  const empresaId = await getEmpresaId(supabase, user.id)
  if (!empresaId) return { error: 'Empresa não encontrada' }
  const unidadeId = await getUnidadeEscrita(supabase, empresaId)
  if (!unidadeId) return { error: 'Unidade não encontrada' }
  if (!(await temAcesso(user.id, ['encomenda'], { unidadeId })))
    return { error: 'Sem permissão para criar encomendas nesta unidade' }

  const itensCalc = itens
    .filter((i) => i.quantidade > 0 && i.descricao.trim())
    .map((i) => ({ ...i, subtotal: dados.com_valor ? subtotalItem(i.quantidade, i.preco_unitario) : 0 }))
  if (itensCalc.length === 0) return { error: 'Nenhum item válido' }
  const total = dados.com_valor
    ? totalPedido(itensCalc.map((i) => ({ quantidade: i.quantidade, precoUnitario: i.preco_unitario })))
    : 0

  const { data: enc, error: e1 } = await supabase
    .from('encomenda')
    .insert({
      empresa_id: empresaId, unidade_id: unidadeId,
      cliente_nome: dados.cliente_nome.trim(),
      cliente_contato: dados.cliente_contato?.trim() || null,
      data_entrega: dados.data_entrega,
      hora_entrega: dados.hora_entrega?.trim() || null,
      com_valor: dados.com_valor,
      rastrear_status: dados.rastrear_status,
      total,
      observacao: dados.observacao?.trim() || null,
      status: 'pendente',
    })
    .select('id').single()
  if (e1 || !enc) return { error: 'Erro ao salvar encomenda: ' + (e1?.message ?? '') }

  const { error: e2 } = await supabase.from('encomenda_item').insert(
    itensCalc.map((i) => ({
      encomenda_id: enc.id, produto_id: i.produto_id,
      descricao: i.descricao.trim(), quantidade: i.quantidade,
      preco_unitario: dados.com_valor ? i.preco_unitario : 0, subtotal: i.subtotal,
      observacao: i.observacao?.trim() || null, local: i.local?.trim() || null,
    }))
  )
  if (e2) return { error: 'Encomenda criada, mas erro nos itens: ' + e2.message }

  // Registra o status inicial no histórico.
  await supabase.from('encomenda_status_log').insert({
    empresa_id: empresaId, unidade_id: unidadeId, encomenda_id: enc.id, status: 'pendente', changed_by: user.id,
  })

  await upsertCliente(supabase, empresaId, unidadeId, dados.cliente_nome, dados.cliente_contato)

  revalidatePath('/dashboard/encomendas')
  return { data: { id: enc.id } }
}

// ── Listar encomendas (unidade atual; filtros) ──────────────────────────────────
export async function listarEncomendas(filtros?: { busca?: string; status?: EncomendaStatus; data?: string }): Promise<ActionResult<{ itens: EncomendaListItem[]; podeVerValores: boolean }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const podeVerValores = await temAcesso(user.id, ['encomenda'], { nivel: 'admin' })
  const unidadeId = await getUnidadePreferida()
  let q = supabase.from('encomenda')
    .select('id, numero, cliente_nome, data_entrega, hora_entrega, status, com_valor, total')
    .order('data_entrega', { ascending: true })
  if (unidadeId) q = q.eq('unidade_id', unidadeId)
  if (filtros?.status) q = q.eq('status', filtros.status)
  if (filtros?.data) q = q.eq('data_entrega', filtros.data)
  if (filtros?.busca?.trim()) q = q.ilike('cliente_nome', `%${filtros.busca.trim()}%`)
  const { data, error } = await q
  if (error) return { error: error.message }
  // Produção (sem nível admin) não recebe os valores no payload
  const itens = ((data as EncomendaListItem[]) ?? []).map((e) => podeVerValores ? e : { ...e, total: 0 })
  return { data: { itens, podeVerValores } }
}

// ── Buscar uma encomenda ────────────────────────────────────────────────────────
export async function getEncomenda(id: string): Promise<ActionResult<EncomendaDetalhe>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const [encRes, itensRes, logRes] = await Promise.all([
    supabase.from('encomenda').select('*, unidade:unidade_id ( nome, documento )').eq('id', id).maybeSingle(),
    supabase.from('encomenda_item').select('id, produto_id, descricao, quantidade, preco_unitario, subtotal, observacao, local').eq('encomenda_id', id),
    supabase.from('encomenda_status_log').select('status, changed_at').eq('encomenda_id', id).order('changed_at', { ascending: true }),
  ])
  const e = encRes.data as (Record<string, unknown> & { unidade: { nome: string; documento: string | null } | null }) | null
  if (!e) return { error: 'Encomenda não encontrada' }

  const podeVerValores = await temAcesso(user.id, ['encomenda'], { nivel: 'admin' })
  type ItemRaw = Omit<EncomendaDetalhe['itens'][number], 'unidade'>
  const itensRaw = (itensRes.data as ItemRaw[]) ?? []

  // Unidade de venda por item (produto → receita.rendimento_unidade) p/ a comanda
  // mostrar "2 kg" em vez de só "2". Avulso (sem produto) fica sem unidade.
  const pids = itensRaw.map((i) => i.produto_id).filter((x): x is string => !!x)
  const unidadeMap = new Map<string, string | null>()
  if (pids.length > 0) {
    const { data: prods } = await supabase.from('produto').select('id, receita:receita_id ( rendimento_unidade )').in('id', pids)
    for (const p of (prods ?? []) as { id: string; receita: { rendimento_unidade: string | null } | { rendimento_unidade: string | null }[] | null }[]) {
      const rec = Array.isArray(p.receita) ? p.receita[0] : p.receita
      unidadeMap.set(p.id, rec?.rendimento_unidade ?? null)
    }
  }
  const withUnidade = itensRaw.map((i) => ({
    ...i,
    unidade: i.produto_id ? unidadeGrande(unidadeMap.get(i.produto_id) ?? null) : null,
  }))
  // Produção (sem nível admin) não recebe os valores no payload
  const itens = podeVerValores ? withUnidade : withUnidade.map((i) => ({ ...i, preco_unitario: 0, subtotal: 0 }))

  return {
    data: {
      id: e.id as string,
      numero: e.numero as number,
      cliente_nome: e.cliente_nome as string,
      cliente_contato: (e.cliente_contato as string | null) ?? null,
      data_entrega: e.data_entrega as string,
      hora_entrega: (e.hora_entrega as string | null) ?? null,
      status: e.status as EncomendaStatus,
      com_valor: e.com_valor as boolean,
      total: podeVerValores ? (e.total as number) : 0,
      observacao: (e.observacao as string | null) ?? null,
      created_at: e.created_at as string,
      unidade_nome: e.unidade?.nome ?? null,
      unidade_documento: e.unidade?.documento ?? null,
      rastrear_status: (e.rastrear_status as boolean | null) ?? true,
      historico: (logRes.data as EncomendaStatusEvento[]) ?? [],
      podeVerValores,
      itens,
    },
  }
}

// ── Editar encomenda (atualiza campos + substitui itens) ────────────────────────
// Requer nível admin na tela (podeVerValores): quem não vê valores zeraria os preços.
export async function atualizarEncomenda(
  id: string,
  dados: EncomendaDados,
  itens: EncomendaItemInput[],
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!dados.cliente_nome.trim()) return { error: 'Informe o nome do cliente' }
  if (!dados.data_entrega) return { error: 'Informe a data de entrega' }
  if (!dados.hora_entrega) return { error: 'Informe a hora de entrega' }
  if (itens.length === 0) return { error: 'Adicione ao menos um item' }
  if (!(await temAcesso(user.id, ['encomenda'], { nivel: 'admin' })))
    return { error: 'Sem permissão para editar esta encomenda' }

  const { data: atual } = await supabase.from('encomenda').select('empresa_id, unidade_id').eq('id', id).maybeSingle()
  if (!atual) return { error: 'Encomenda não encontrada' }

  const itensCalc = itens
    .filter((i) => i.quantidade > 0 && i.descricao.trim())
    .map((i) => ({ ...i, subtotal: subtotalItem(i.quantidade, i.preco_unitario) }))
  if (itensCalc.length === 0) return { error: 'Nenhum item válido' }
  const total = totalPedido(itensCalc.map((i) => ({ quantidade: i.quantidade, precoUnitario: i.preco_unitario })))

  const { error: e1 } = await supabase.from('encomenda').update({
    cliente_nome: dados.cliente_nome.trim(),
    cliente_contato: dados.cliente_contato?.trim() || null,
    data_entrega: dados.data_entrega,
    hora_entrega: dados.hora_entrega?.trim() || null,
    com_valor: true,
    rastrear_status: dados.rastrear_status,
    total,
    observacao: dados.observacao?.trim() || null,
  }).eq('id', id)
  if (e1) return { error: 'Erro ao salvar: ' + e1.message }

  const { error: eDel } = await supabase.from('encomenda_item').delete().eq('encomenda_id', id)
  if (eDel) return { error: 'Erro ao atualizar itens: ' + eDel.message }
  const { error: e2 } = await supabase.from('encomenda_item').insert(
    itensCalc.map((i) => ({
      encomenda_id: id, produto_id: i.produto_id,
      descricao: i.descricao.trim(), quantidade: i.quantidade,
      preco_unitario: i.preco_unitario, subtotal: i.subtotal,
      observacao: i.observacao?.trim() || null, local: i.local?.trim() || null,
    }))
  )
  if (e2) return { error: 'Erro ao gravar itens: ' + e2.message }

  await upsertCliente(supabase, atual.empresa_id as string, atual.unidade_id as string, dados.cliente_nome, dados.cliente_contato)

  revalidatePath('/dashboard/encomendas')
  revalidatePath(`/dashboard/encomendas/${id}`)
  return { data: { id } }
}

// ── Atualizar status ────────────────────────────────────────────────────────────
export async function atualizarStatusEncomenda(id: string, status: EncomendaStatus): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!ENCOMENDA_STATUS.includes(status)) return { error: 'Status inválido' }
  if (!(await temAcesso(user.id, ['encomenda']))) return { error: 'Sem permissão' }

  const { data: atual } = await supabase.from('encomenda').select('empresa_id, unidade_id, status').eq('id', id).maybeSingle()
  if (!atual) return { error: 'Encomenda não encontrada' }

  const { error } = await supabase.from('encomenda').update({ status }).eq('id', id)
  if (error) return { error: error.message }

  // Só registra no histórico se o status realmente mudou.
  if (atual.status !== status) {
    await supabase.from('encomenda_status_log').insert({
      empresa_id: atual.empresa_id, unidade_id: atual.unidade_id, encomenda_id: id, status, changed_by: user.id,
    })
  }

  revalidatePath('/dashboard/encomendas')
  revalidatePath(`/dashboard/encomendas/${id}`)
  return { success: true }
}

// ── Excluir ─────────────────────────────────────────────────────────────────────
export async function excluirEncomenda(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!(await temAcesso(user.id, ['encomenda']))) return { error: 'Sem permissão' }
  const { error } = await supabase.from('encomenda').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/encomendas')
  return { success: true }
}
