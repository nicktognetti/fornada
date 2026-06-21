'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { parseDecimalBR } from '@/lib/format'
import { getUnidadePreferida } from '@/app/actions/unidade'
import type { ActionResult } from './types'

function isPositiveNum(val: unknown) {
  if (typeof val !== 'string') return false
  const n = parseDecimalBR(val)
  return !isNaN(n) && n > 0
}

async function getEmpresaId(userId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('usuario_empresa')
    .select('empresa_id')
    .eq('user_id', userId)
    .single()
  return data?.empresa_id ?? null
}

// Unidade a usar ao criar registros: a preferida (cookie) se válida para a
// empresa, senão a primeira unidade ativa da empresa. Evita registros órfãos
// de unidade que somem sob o filtro por unidade das telas.
async function getUnidadeEscrita(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string
): Promise<string | null> {
  const pref = await getUnidadePreferida()
  if (pref) {
    const { data } = await supabase
      .from('unidade').select('id').eq('id', pref).eq('empresa_id', empresaId).maybeSingle()
    if (data) return data.id
  }
  const { data } = await supabase
    .from('unidade').select('id')
    .eq('empresa_id', empresaId).eq('ativa', true).order('nome').limit(1).maybeSingle()
  return data?.id ?? null
}

const ReceitaSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  tipo: z.enum(['final', 'base']),
  rendimento: z.string().refine(isPositiveNum, 'Rendimento deve ser maior que zero'),
  rendimento_unidade: z.enum(['g', 'kg', 'ml', 'l', 'un']),
  observacao: z.string().optional(),
})

const ItemSchema = z.object({
  receita_id: z.string().uuid('receita_id inválido'),
  quantidade: z.string().refine(isPositiveNum, 'Quantidade deve ser maior que zero'),
})

// ─── Criar receita ─────────────────────────────────────────────────────────────

export async function createReceita(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const empresaId = await getEmpresaId(user.id)
  if (!empresaId) return { error: 'Empresa não encontrada' }

  const unidadeId = await getUnidadeEscrita(supabase, empresaId)

  const raw = {
    nome: formData.get('nome'),
    tipo: formData.get('tipo'),
    rendimento: formData.get('rendimento'),
    rendimento_unidade: formData.get('rendimento_unidade'),
    observacao: formData.get('observacao') || undefined,
  }

  const result = ReceitaSchema.safeParse(raw)
  if (!result.success) return { error: result.error.issues[0].message }

  const { error } = await supabase.from('receita').insert({
    nome: result.data.nome,
    tipo: result.data.tipo,
    rendimento: parseDecimalBR(result.data.rendimento),
    rendimento_unidade: result.data.rendimento_unidade,
    observacao: result.data.observacao ?? null,
    empresa_id: empresaId,
    unidade_id: unidadeId,
    ativo: true,
  })

  if (error) return { error: 'Erro ao criar receita: ' + error.message }

  revalidatePath('/dashboard/receitas')
  return { success: true }
}

// ─── Editar receita ─────────────────────────────────────────────────────────────

export async function updateReceita(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const id = formData.get('id') as string
  if (!id) return { error: 'ID não informado' }

  const raw = {
    nome: formData.get('nome'),
    tipo: formData.get('tipo'),
    rendimento: formData.get('rendimento'),
    rendimento_unidade: formData.get('rendimento_unidade'),
    observacao: formData.get('observacao') || undefined,
  }

  const result = ReceitaSchema.safeParse(raw)
  if (!result.success) return { error: result.error.issues[0].message }

  const { error } = await supabase.from('receita').update({
    nome: result.data.nome,
    tipo: result.data.tipo,
    rendimento: parseDecimalBR(result.data.rendimento),
    rendimento_unidade: result.data.rendimento_unidade,
    observacao: result.data.observacao ?? null,
  }).eq('id', id)

  if (error) return { error: 'Erro ao salvar: ' + error.message }

  revalidatePath('/dashboard/receitas')
  revalidatePath(`/dashboard/receitas/${id}`)
  return { success: true }
}

// ─── Excluir receita ────────────────────────────────────────────────────────────

export async function deleteReceita(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  // Bloquear se usada como sub-receita em outra ficha
  const { data: refs } = await supabase
    .from('receita_item')
    .select('receita_id')
    .eq('sub_receita_id', id)
    .limit(1)

  if (refs && refs.length > 0) {
    return { error: 'Esta receita é usada como sub-receita em outra ficha. Remova a referência antes de excluir.' }
  }

  const { error } = await supabase.from('receita').update({ ativo: false }).eq('id', id)
  if (error) return { error: 'Erro ao excluir: ' + error.message }

  revalidatePath('/dashboard/receitas')
  return { success: true }
}

// ─── Detecção de ciclo ─────────────────────────────────────────────────────────

async function hasCycle(
  parentReceitaId: string,
  subReceitaId: string
): Promise<boolean> {
  const supabase = await createClient()
  const visited = new Set<string>()
  const queue = [subReceitaId]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (current === parentReceitaId) return true
    if (visited.has(current)) continue
    visited.add(current)

    const { data } = await supabase
      .from('receita_item')
      .select('sub_receita_id')
      .eq('receita_id', current)
      .not('sub_receita_id', 'is', null)

    for (const item of data ?? []) {
      if (item.sub_receita_id) queue.push(item.sub_receita_id)
    }
  }
  return false
}

// ─── Adicionar item ─────────────────────────────────────────────────────────────

export async function addItem(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const raw = {
    receita_id: formData.get('receita_id'),
    quantidade: formData.get('quantidade'),
  }

  const base = ItemSchema.safeParse(raw)
  if (!base.success) return { error: base.error.issues[0].message }

  const insumo_id = (formData.get('insumo_id') as string) || null
  const sub_receita_id = (formData.get('sub_receita_id') as string) || null

  if (!insumo_id && !sub_receita_id) {
    return { error: 'Selecione um insumo ou uma sub-receita' }
  }
  if (insumo_id && sub_receita_id) {
    return { error: 'Selecione apenas insumo OU sub-receita, não os dois' }
  }

  // Verificar ciclo
  if (sub_receita_id) {
    if (sub_receita_id === base.data.receita_id) {
      return { error: 'Uma receita não pode referenciar a si mesma' }
    }
    const cycle = await hasCycle(base.data.receita_id, sub_receita_id)
    if (cycle) {
      return { error: 'Referência circular detectada: essa sub-receita já depende desta ficha' }
    }
  }

  const { error } = await supabase.from('receita_item').insert({
    receita_id: base.data.receita_id,
    insumo_id,
    sub_receita_id,
    quantidade: parseDecimalBR(base.data.quantidade),
  })

  if (error) return { error: 'Erro ao adicionar item: ' + error.message }

  revalidatePath(`/dashboard/receitas/${base.data.receita_id}`)
  return { success: true }
}

// ─── Editar item ────────────────────────────────────────────────────────────────

export async function updateItem(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const id = formData.get('id') as string
  const receita_id = formData.get('receita_id') as string
  if (!id || !receita_id) return { error: 'IDs não informados' }

  const quantidade = formData.get('quantidade') as string
  if (!isPositiveNum(quantidade)) return { error: 'Quantidade deve ser maior que zero' }

  const insumo_id = (formData.get('insumo_id') as string) || null
  const sub_receita_id = (formData.get('sub_receita_id') as string) || null

  if (!insumo_id && !sub_receita_id) {
    return { error: 'Selecione um insumo ou uma sub-receita' }
  }

  if (sub_receita_id) {
    if (sub_receita_id === receita_id) {
      return { error: 'Uma receita não pode referenciar a si mesma' }
    }
    const cycle = await hasCycle(receita_id, sub_receita_id)
    if (cycle) {
      return { error: 'Referência circular detectada' }
    }
  }

  const { error } = await supabase.from('receita_item').update({
    insumo_id,
    sub_receita_id,
    quantidade: parseDecimalBR(quantidade),
  }).eq('id', id)

  if (error) return { error: 'Erro ao salvar item: ' + error.message }

  revalidatePath(`/dashboard/receitas/${receita_id}`)
  return { success: true }
}

// ─── Remover item ───────────────────────────────────────────────────────────────

export async function removeItem(id: string, receitaId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase.from('receita_item').delete().eq('id', id)
  if (error) return { error: 'Erro ao remover item: ' + error.message }

  revalidatePath(`/dashboard/receitas/${receitaId}`)
  return { success: true }
}

// ─── Buscar insumos para autocomplete ─────────────────────────────────────────

export async function getInsumos() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('insumo')
    .select('id, nome, categoria, unidade_uso')
    .eq('ativo', true)
    .order('nome')
  return data ?? []
}

// ─── Buscar receitas para sub-receita (excluindo a atual) ─────────────────────

export async function getReceitasParaSubReceita(excluirId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('receita')
    .select('id, nome, rendimento_unidade')
    .eq('ativo', true)
    .neq('id', excluirId)
    .order('nome')
  return data ?? []
}
