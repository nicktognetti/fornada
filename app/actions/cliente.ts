'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { temAcesso } from '@/app/lib/authz'
import { getUnidadePreferida, getUnidadeAutorizada } from '@/app/actions/unidade'

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

type ActionResult<T = void> = T extends void
  ? { error?: string; success?: boolean }
  : { error?: string; data?: T }

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

  const empresaId = await getEmpresaId(supabase, user.id)
  if (!empresaId) return { error: 'Empresa não encontrada' }
  const unidadeId = await getUnidadeEscrita(supabase, empresaId)
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
  if (!(await temAcesso(user.id, ['clientes']))) return { error: 'Sem permissão' }

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
  if (!(await temAcesso(user.id, ['clientes']))) return { error: 'Sem permissão' }
  const { error } = await supabase.from('cliente').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/clientes')
  return { success: true }
}
