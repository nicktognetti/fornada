'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { parseDecimalBR } from '@/lib/format'
import { getUnidadeAutorizada } from '@/app/actions/unidade'
import { temAcesso, unidadeDoRegistro } from '@/app/lib/authz'
import type { ActionResult } from './types'

function isPositiveNum(val: unknown) {
  if (typeof val !== 'string') return false
  const n = parseDecimalBR(val)
  return !isNaN(n) && n > 0
}

// Inteiro positivo opcional (tempos/temperatura) a partir do FormData.
// Vazio → null; inválido/≤0 → null (o CHECK do banco também protege).
function optInt(val: FormDataEntryValue | null): number | null {
  if (typeof val !== 'string' || val.trim() === '') return null
  const n = parseInt(val.replace(/\D/g, ''), 10)
  return !isNaN(n) && n > 0 ? n : null
}

// Passos vêm do modal como JSON. Aceita array de strings, descarta vazios,
// limita tamanho por passo. Qualquer coisa fora do formato vira lista vazia.
function parsePassos(val: FormDataEntryValue | null): string[] {
  if (typeof val !== 'string' || val.trim() === '') return []
  try {
    const arr = JSON.parse(val)
    if (!Array.isArray(arr)) return []
    return arr
      .filter((p): p is string => typeof p === 'string')
      .map((p) => p.trim().slice(0, 1000))
      .filter((p) => p.length > 0)
  } catch {
    return []
  }
}

const DIFICULDADES = ['facil', 'media', 'dificil'] as const
function parseDificuldade(val: FormDataEntryValue | null): 'facil' | 'media' | 'dificil' | null {
  return typeof val === 'string' && (DIFICULDADES as readonly string[]).includes(val)
    ? (val as 'facil' | 'media' | 'dificil')
    : null
}

const BUCKET_FOTOS = 'receita-fotos'
const FOTO_MAX_BYTES = 5 * 1024 * 1024
const FOTO_TIPOS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

async function getEmpresaId(userId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('usuario_empresa')
    .select('empresa_id')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.empresa_id ?? null
}

// Unidade a usar ao criar registros: a preferida (cookie) se válida para a
// empresa, senão a primeira unidade ativa da empresa. Evita registros órfãos
// de unidade que somem sob o filtro por unidade das telas.
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
  if (!(await temAcesso(user.id, ['receitas'], { unidadeId })))
    return { error: 'Sem permissão para criar fichas nesta unidade' }

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
    passos: parsePassos(formData.get('passos')),
    tempo_preparo_min: optInt(formData.get('tempo_preparo_min')),
    temperatura_forno: optInt(formData.get('temperatura_forno')),
    tempo_forno_min: optInt(formData.get('tempo_forno_min')),
    dificuldade: parseDificuldade(formData.get('dificuldade')),
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

  const unidadeId = await unidadeDoRegistro('receita', id)
  if (!(await temAcesso(user.id, ['receitas'], { unidadeId })))
    return { error: 'Sem permissão para editar fichas nesta unidade' }

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
    passos: parsePassos(formData.get('passos')),
    tempo_preparo_min: optInt(formData.get('tempo_preparo_min')),
    temperatura_forno: optInt(formData.get('temperatura_forno')),
    tempo_forno_min: optInt(formData.get('tempo_forno_min')),
    dificuldade: parseDificuldade(formData.get('dificuldade')),
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

  const unidadeId = await unidadeDoRegistro('receita', id)
  if (!(await temAcesso(user.id, ['receitas'], { unidadeId })))
    return { error: 'Sem permissão para excluir fichas nesta unidade' }

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

  const unidadeId = await unidadeDoRegistro('receita', base.data.receita_id)
  if (!(await temAcesso(user.id, ['receitas'], { unidadeId })))
    return { error: 'Sem permissão para editar fichas nesta unidade' }

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

// ─── Adicionar vários itens de uma vez ───────────────────────────────────────────
// Insere N itens numa ficha em uma única operação (checa permissão uma vez e ciclos
// por sub-receita). Usado pelo modal "lista" para não abrir/fechar a cada item.

export async function addItensLote(
  receitaId: string,
  itens: { insumo_id: string | null; sub_receita_id: string | null; quantidade: number }[],
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  if (!receitaId) return { error: 'receita_id não informado' }
  if (!itens || itens.length === 0) return { error: 'Nenhum item para adicionar' }

  const unidadeId = await unidadeDoRegistro('receita', receitaId)
  if (!(await temAcesso(user.id, ['receitas'], { unidadeId })))
    return { error: 'Sem permissão para editar fichas nesta unidade' }

  for (const it of itens) {
    if (!it.insumo_id && !it.sub_receita_id) return { error: 'Um dos itens está sem insumo ou sub-receita' }
    if (it.insumo_id && it.sub_receita_id) return { error: 'Um item não pode ter insumo E sub-receita' }
    if (!(it.quantidade > 0)) return { error: 'Todas as quantidades devem ser maiores que zero' }
    if (it.sub_receita_id) {
      if (it.sub_receita_id === receitaId) return { error: 'Uma receita não pode referenciar a si mesma' }
      if (await hasCycle(receitaId, it.sub_receita_id))
        return { error: 'Referência circular detectada em uma das sub-receitas' }
    }
  }

  const { error } = await supabase.from('receita_item').insert(
    itens.map((it) => ({
      receita_id: receitaId,
      insumo_id: it.insumo_id,
      sub_receita_id: it.sub_receita_id,
      quantidade: it.quantidade,
    })),
  )

  if (error) return { error: 'Erro ao adicionar itens: ' + error.message }

  revalidatePath(`/dashboard/receitas/${receitaId}`)
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

  const unidadeId = await unidadeDoRegistro('receita', receita_id)
  if (!(await temAcesso(user.id, ['receitas'], { unidadeId })))
    return { error: 'Sem permissão para editar fichas nesta unidade' }

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

  const unidadeId = await unidadeDoRegistro('receita', receitaId)
  if (!(await temAcesso(user.id, ['receitas'], { unidadeId })))
    return { error: 'Sem permissão para editar fichas nesta unidade' }

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

// ─── Foto da receita (Storage) ────────────────────────────────────────────────
// Mesmo desenho da foto de produto: bucket público, escrita via service role.

// Loja/empresa reais da receita via service role (RLS esconderia o registro e a
// checagem de permissão liberaria por engano) + foto atual para limpeza.
async function getReceitaReal(receitaId: string) {
  const { data } = await supabaseAdmin
    .from('receita')
    .select('id, empresa_id, unidade_id, foto_url')
    .eq('id', receitaId)
    .maybeSingle()
  return data as { id: string; empresa_id: string; unidade_id: string | null; foto_url: string | null } | null
}

// Caminho do objeto no bucket a partir da URL pública salva em foto_url.
function pathDaFotoUrl(fotoUrl: string | null): string | null {
  if (!fotoUrl) return null
  const marca = `/${BUCKET_FOTOS}/`
  const i = fotoUrl.indexOf(marca)
  return i === -1 ? null : decodeURIComponent(fotoUrl.slice(i + marca.length))
}

export async function uploadReceitaFoto(
  receitaId: string,
  formData: FormData,
): Promise<{ error?: string; data?: { foto_url: string } }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const file = formData.get('foto')
  if (!(file instanceof File) || file.size === 0) return { error: 'Selecione uma imagem' }
  const ext = FOTO_TIPOS[file.type]
  if (!ext) return { error: 'Formato não suportado — use JPG, PNG ou WebP' }
  if (file.size > FOTO_MAX_BYTES) return { error: 'Imagem muito grande (máx. 5 MB)' }

  const rec = await getReceitaReal(receitaId)
  if (!rec) return { error: 'Receita não encontrada' }
  if (!(await temAcesso(user.id, ['receitas'], { unidadeId: rec.unidade_id })))
    return { error: 'Sem permissão para alterar fichas nesta loja' }

  // Timestamp no nome: evita cache velho no navegador ao trocar a foto.
  const path = `${rec.empresa_id}/${receitaId}-${Date.now()}.${ext}`
  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET_FOTOS)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: true })
  if (upErr) return { error: `Falha no upload: ${upErr.message}` }

  const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET_FOTOS).getPublicUrl(path)

  const { error } = await supabase.from('receita').update({ foto_url: publicUrl }).eq('id', receitaId)
  if (error) return { error: error.message }

  // Remove a foto anterior (falha aqui não é fatal).
  const antiga = pathDaFotoUrl(rec.foto_url)
  if (antiga && antiga !== path) await supabaseAdmin.storage.from(BUCKET_FOTOS).remove([antiga])

  revalidatePath(`/dashboard/receitas/${receitaId}`)
  return { data: { foto_url: publicUrl } }
}

export async function removeReceitaFoto(receitaId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const rec = await getReceitaReal(receitaId)
  if (!rec) return { error: 'Receita não encontrada' }
  if (!(await temAcesso(user.id, ['receitas'], { unidadeId: rec.unidade_id })))
    return { error: 'Sem permissão para alterar fichas nesta loja' }

  const { error } = await supabase.from('receita').update({ foto_url: null }).eq('id', receitaId)
  if (error) return { error: error.message }

  const path = pathDaFotoUrl(rec.foto_url)
  if (path) await supabaseAdmin.storage.from(BUCKET_FOTOS).remove([path])

  revalidatePath(`/dashboard/receitas/${receitaId}`)
  return { success: true }
}
