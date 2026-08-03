'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { temAcesso } from '@/app/lib/authz'
import { getUnidadePreferida } from '@/app/actions/unidade'
import { getEmpresaId, getUnidadeEscrita } from '@/app/lib/escopo'
import type { ActionResult } from '@/lib/action-result'

export type ClienteAutocomplete = { nome: string; telefone: string | null }
export type ClienteRow = {
  id: string
  nome: string
  telefone: string | null
  email: string | null
  endereco: string | null
  documento: string | null
  observacao: string | null
  created_at: string
}
export type ClienteInput = {
  nome: string
  telefone?: string | null
  email?: string | null
  endereco?: string | null
  documento?: string | null
  observacao?: string | null
}




// Normaliza os campos textuais (trim → null quando vazio).
function limpar(dados: ClienteInput) {
  return {
    nome: dados.nome.trim(),
    telefone: dados.telefone?.trim() || null,
    email: dados.email?.trim() || null,
    endereco: dados.endereco?.trim() || null,
    documento: dados.documento?.trim() || null,
    observacao: dados.observacao?.trim() || null,
  }
}

/** Clientes da unidade atual, para autocomplete no builder de orçamento/encomenda. */
export async function getClientes(): Promise<ClienteAutocomplete[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const unidadeId = await getUnidadePreferida()
  let q = supabase.from('cliente').select('nome, telefone').order('nome')
  if (unidadeId) q = q.eq('unidade_id', unidadeId)
  const { data } = await q
  return (data as ClienteAutocomplete[]) ?? []
}

/** Lista completa (com id) para a tela de gestão de clientes da unidade atual. */
export async function listarClientes(): Promise<ActionResult<ClienteRow[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const unidadeId = await getUnidadePreferida()
  let q = supabase.from('cliente').select('id, nome, telefone, email, endereco, documento, observacao, created_at').order('nome')
  if (unidadeId) q = q.eq('unidade_id', unidadeId)
  const { data, error } = await q
  if (error) return { error: error.message }
  return { data: (data as ClienteRow[]) ?? [] }
}

/** Cadastro manual de um cliente na unidade atual. */
export async function criarCliente(dados: ClienteInput): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!dados.nome.trim()) return { error: 'Informe o nome do cliente' }

  const empresaId = await getEmpresaId(user.id, supabase)
  if (!empresaId) return { error: 'Empresa não encontrada' }
  const unidadeId = await getUnidadeEscrita(empresaId, supabase)
  if (!unidadeId) return { error: 'Unidade não encontrada' }
  if (!(await temAcesso(user.id, ['clientes'], { unidadeId })))
    return { error: 'Sem permissão para cadastrar clientes nesta unidade' }

  const { data, error } = await supabase
    .from('cliente')
    .insert({ empresa_id: empresaId, unidade_id: unidadeId, ...limpar(dados) })
    .select('id').single()
  if (error) {
    if (error.code === '23505') return { error: 'Já existe um cliente com esse nome nesta loja' }
    return { error: error.message }
  }
  revalidatePath('/dashboard/clientes')
  return { data: { id: data.id } }
}

/** Atualiza os dados de um cliente. */
export async function atualizarCliente(id: string, dados: ClienteInput): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!dados.nome.trim()) return { error: 'Informe o nome do cliente' }

  // Escopo por LOJA: sem a unidade do registro, quem tem a tela na loja A
  // conseguia editar cliente da loja B (a RLS enxerga as duas).
  const { data: atual } = await supabase.from('cliente').select('unidade_id').eq('id', id).maybeSingle()
  if (!atual) return { error: 'Cliente não encontrado' }
  if (!(await temAcesso(user.id, ['clientes'], { unidadeId: atual.unidade_id as string })))
    return { error: 'Sem permissão para editar clientes desta loja' }

  const { error } = await supabase.from('cliente').update(limpar(dados)).eq('id', id)
  if (error) {
    if (error.code === '23505') return { error: 'Já existe um cliente com esse nome nesta loja' }
    return { error: error.message }
  }
  revalidatePath('/dashboard/clientes')
  return { success: true }
}

/** Exclui um cliente (não afeta orçamentos/encomendas já lançados). */
export async function excluirCliente(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { data: atual } = await supabase.from('cliente').select('unidade_id').eq('id', id).maybeSingle()
  if (!atual) return { error: 'Cliente não encontrado' }
  if (!(await temAcesso(user.id, ['clientes'], { unidadeId: atual.unidade_id as string })))
    return { error: 'Sem permissão para excluir clientes desta loja' }

  const { error } = await supabase.from('cliente').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/clientes')
  return { success: true }
}
