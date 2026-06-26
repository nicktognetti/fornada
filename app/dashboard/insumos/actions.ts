'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { parseDecimalBR } from '@/lib/format'
import { getUnidadeAutorizada } from '@/app/actions/unidade'
import { temAcesso, unidadeDoRegistro } from '@/app/lib/authz'
import type { ActionResult, InsumoPreco } from './types'

function parseNum(val: unknown): number {
  if (typeof val !== 'string') return NaN
  return parseDecimalBR(val)
}

function isPositiveNum(val: unknown) {
  const n = parseNum(val)
  return !isNaN(n) && n > 0
}

const InsumoSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  categoria: z.string().min(1, 'Categoria obrigatória'),
  unidade_uso: z.enum(['g', 'ml', 'un']),
})

const PrecoSchema = z.object({
  unidade_compra: z.string().min(1, 'Unidade de compra obrigatória'),
  preco_compra: z
    .string()
    .refine(isPositiveNum, 'Preço deve ser maior que zero'),
  qtd_uso_por_compra: z
    .string()
    .refine(isPositiveNum, 'Quantidade deve ser maior que zero'),
})

async function getEmpresaId(userId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('usuario_empresa')
    .select('empresa_id')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.empresa_id ?? null
}

// Unidade a usar ao criar registros: a AUTORIZADA (cookie validado contra os
// vínculos do usuário) se pertencer à empresa, senão a primeira unidade ativa
// da empresa. A permissão de módulo nesta loja é checada à parte via temAcesso.
async function getUnidadeEscrita(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string
): Promise<string | null> {
  const pref = await getUnidadeAutorizada()
  if (pref) {
    const { data } = await supabase
      .from('unidade').select('id').eq('id', pref).eq('empresa_id', empresaId).maybeSingle()
    if (data) return data.id
  }
  const { data } = await supabase
    .from('unidade').select('id')
    .eq('empresa_id', empresaId).eq('ativo', true).order('nome').limit(1).maybeSingle()
  return data?.id ?? null
}

function getFormFields(formData: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, formData.get(k)]))
}

// ─── Criar insumo + primeiro preço ────────────────────────────────────────────

export async function createInsumo(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const empresaId = await getEmpresaId(user.id)
  if (!empresaId) return { error: 'Empresa não encontrada' }

  const unidadeId = await getUnidadeEscrita(supabase, empresaId)
  if (!(await temAcesso(user.id, ['insumos'], { unidadeId })))
    return { error: 'Sem permissão para criar insumos nesta unidade' }

  const raw = getFormFields(formData, [
    'nome',
    'categoria',
    'unidade_uso',
    'unidade_compra',
    'preco_compra',
    'qtd_uso_por_compra',
  ])

  const insumoR = InsumoSchema.safeParse(raw)
  const precoR = PrecoSchema.safeParse(raw)

  if (!insumoR.success) return { error: insumoR.error.issues[0].message }
  if (!precoR.success) return { error: precoR.error.issues[0].message }

  const { data: insumo, error: e1 } = await supabase
    .from('insumo')
    .insert({ ...insumoR.data, empresa_id: empresaId, unidade_id: unidadeId, ativo: true })
    .select('id')
    .single()

  if (e1 || !insumo) return { error: 'Erro ao criar insumo: ' + (e1?.message ?? '') }

  const { error: e2 } = await supabase.from('insumo_preco').insert({
    insumo_id: insumo.id,
    unidade_compra: precoR.data.unidade_compra,
    preco_compra: parseNum(precoR.data.preco_compra),
    qtd_uso_por_compra: parseNum(precoR.data.qtd_uso_por_compra),
    vigente_desde: new Date().toISOString().split('T')[0],
  })

  if (e2) return { error: 'Insumo criado, mas erro no preço: ' + e2.message }

  revalidatePath('/dashboard/insumos')
  return { success: true }
}

// ─── Editar dados do insumo ────────────────────────────────────────────────────

export async function updateInsumo(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const id = formData.get('id') as string
  if (!id) return { error: 'ID não informado' }

  const unidadeId = await unidadeDoRegistro('insumo', id)
  if (!(await temAcesso(user.id, ['insumos'], { unidadeId })))
    return { error: 'Sem permissão para editar insumos nesta unidade' }

  const raw = getFormFields(formData, ['nome', 'categoria', 'unidade_uso'])
  const result = InsumoSchema.safeParse(raw)
  if (!result.success) return { error: result.error.issues[0].message }

  const { error } = await supabase
    .from('insumo')
    .update(result.data)
    .eq('id', id)

  if (error) return { error: 'Erro ao salvar: ' + error.message }

  revalidatePath('/dashboard/insumos')
  return { success: true }
}

// ─── Registrar novo preço (INSERT, nunca UPDATE) ───────────────────────────────

export async function addPreco(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const insumo_id = formData.get('insumo_id') as string
  if (!insumo_id) return { error: 'Insumo não informado' }

  const unidadeId = await unidadeDoRegistro('insumo', insumo_id)
  if (!(await temAcesso(user.id, ['insumos'], { unidadeId })))
    return { error: 'Sem permissão para editar insumos nesta unidade' }

  const raw = getFormFields(formData, [
    'unidade_compra',
    'preco_compra',
    'qtd_uso_por_compra',
  ])
  const result = PrecoSchema.safeParse(raw)
  if (!result.success) return { error: result.error.issues[0].message }

  const { error } = await supabase.from('insumo_preco').insert({
    insumo_id,
    unidade_compra: result.data.unidade_compra,
    preco_compra: parseNum(result.data.preco_compra),
    qtd_uso_por_compra: parseNum(result.data.qtd_uso_por_compra),
    vigente_desde: new Date().toISOString().split('T')[0],
  })

  if (error) return { error: 'Erro ao registrar preço: ' + error.message }

  revalidatePath('/dashboard/insumos')
  return { success: true }
}

// ─── Buscar histórico de preços (Server Function chamado do cliente) ───────────

export async function getPrecoHistorico(insumoId: string): Promise<InsumoPreco[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('insumo_preco')
    .select('*')
    .eq('insumo_id', insumoId)
    .order('vigente_desde', { ascending: false })
    .limit(3)
  return (data as InsumoPreco[]) ?? []
}
