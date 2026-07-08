'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { parseDecimalBR } from '@/lib/format'
import { getUnidadeAutorizada } from '@/app/actions/unidade'
import { temAcesso, unidadeDoRegistro, setoresPermitidosCaderno, receitaSetorUnidade } from '@/app/lib/authz'
import { LOCAIS_CONFIG_KEY, LOCAIS_PADRAO } from '@/app/lib/locais'
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

// Setor/categoria: texto livre, vazio → null, comprimento limitado.
function parseCategoria(val: unknown): string | null {
  return typeof val === 'string' && val.trim() ? val.trim().slice(0, 80) : null
}

// Sentinela: "o setor não está sendo alterado" (distinto de mudar para null).
const SETOR_INALTERADO = Symbol('setor-inalterado')

// Confere se o usuário pode mexer numa receita considerando o SETOR dela (além
// da unidade, checada à parte). Gestão/admin não têm restrição de setor. Receita
// SEM setor é acessível a todos (decisão do cliente). Se `novoSetor` for passado,
// também valida o setor de destino (impede mover a receita p/ um setor sem acesso).
async function podeMexerNoSetor(
  userId: string,
  receitaId: string,
  novoSetor: string | null | typeof SETOR_INALTERADO = SETOR_INALTERADO,
): Promise<boolean> {
  const rec = await receitaSetorUnidade(receitaId)
  if (!rec) return false
  const permitidos = await setoresPermitidosCaderno(userId, rec.unidade_id)
  const ok = (setor: string | null) => permitidos === null || setor == null || permitidos.includes(setor)
  if (!ok(rec.categoria)) return false
  if (novoSetor !== SETOR_INALTERADO && !ok(novoSetor)) return false
  return true
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
    categoria: parseCategoria(formData.get('categoria')),
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
    categoria: parseCategoria(formData.get('categoria')),
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
  revalidatePath('/dashboard/caderno')
  revalidatePath(`/dashboard/caderno/${id}`)
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
  if (!(await temAcesso(user.id, ['receitas', 'caderno'], { unidadeId })))
    return { error: 'Sem permissão para editar esta receita nesta unidade' }
  if (!(await podeMexerNoSetor(user.id, base.data.receita_id)))
    return { error: 'Sem permissão para o setor desta receita' }

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

  await flagRevisaoSeProducao(user.id, base.data.receita_id)
  revalidarReceita(base.data.receita_id)
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
  if (!(await temAcesso(user.id, ['receitas', 'caderno'], { unidadeId })))
    return { error: 'Sem permissão para editar esta receita nesta unidade' }
  if (!(await podeMexerNoSetor(user.id, receitaId)))
    return { error: 'Sem permissão para o setor desta receita' }

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

  await flagRevisaoSeProducao(user.id, receitaId)
  revalidarReceita(receitaId)
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
  if (!(await temAcesso(user.id, ['receitas', 'caderno'], { unidadeId })))
    return { error: 'Sem permissão para editar esta receita nesta unidade' }
  if (!(await podeMexerNoSetor(user.id, receita_id)))
    return { error: 'Sem permissão para o setor desta receita' }

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

  await flagRevisaoSeProducao(user.id, receita_id)
  revalidarReceita(receita_id)
  return { success: true }
}

// ─── Remover item ───────────────────────────────────────────────────────────────

export async function removeItem(id: string, receitaId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const unidadeId = await unidadeDoRegistro('receita', receitaId)
  if (!(await temAcesso(user.id, ['receitas', 'caderno'], { unidadeId })))
    return { error: 'Sem permissão para editar esta receita nesta unidade' }
  if (!(await podeMexerNoSetor(user.id, receitaId)))
    return { error: 'Sem permissão para o setor desta receita' }

  const { error } = await supabase.from('receita_item').delete().eq('id', id)
  if (error) return { error: 'Erro ao remover item: ' + error.message }

  await flagRevisaoSeProducao(user.id, receitaId)
  revalidarReceita(receitaId)
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
  if (!(await temAcesso(user.id, ['receitas', 'caderno'], { unidadeId: rec.unidade_id })))
    return { error: 'Sem permissão para alterar esta receita nesta loja' }
  if (!(await podeMexerNoSetor(user.id, receitaId)))
    return { error: 'Sem permissão para o setor desta receita' }

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

  revalidarReceita(receitaId)
  return { data: { foto_url: publicUrl } }
}

export async function removeReceitaFoto(receitaId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const rec = await getReceitaReal(receitaId)
  if (!rec) return { error: 'Receita não encontrada' }
  if (!(await temAcesso(user.id, ['receitas', 'caderno'], { unidadeId: rec.unidade_id })))
    return { error: 'Sem permissão para alterar esta receita nesta loja' }
  if (!(await podeMexerNoSetor(user.id, receitaId)))
    return { error: 'Sem permissão para o setor desta receita' }

  const { error } = await supabase.from('receita').update({ foto_url: null }).eq('id', receitaId)
  if (error) return { error: error.message }

  const path = pathDaFotoUrl(rec.foto_url)
  if (path) await supabaseAdmin.storage.from(BUCKET_FOTOS).remove([path])

  revalidarReceita(receitaId)
  return { success: true }
}

// Revalida todas as telas que mostram uma receita: ficha (Natali) + caderno (produção).
function revalidarReceita(receitaId: string) {
  revalidatePath(`/dashboard/receitas/${receitaId}`)
  revalidatePath('/dashboard/caderno')
  revalidatePath(`/dashboard/caderno/${receitaId}`)
}

// ─── Editar SÓ o modo de fazer (Caderno de Receitas) ──────────────────────────
// Produção/confeitaria edita passos, tempos, dificuldade, dica e (via foto action)
// a foto — NUNCA nome/tipo/rendimento/ingredientes/custo (isso é da Ficha Técnica).
export async function updateModoPreparo(
  receitaId: string,
  payload: {
    categoria: string | null
    passos: string[]
    tempo_preparo_min: number | null
    temperatura_forno: number | null
    tempo_forno_min: number | null
    dificuldade: 'facil' | 'media' | 'dificil' | null
    observacao: string | null
  },
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!receitaId) return { error: 'Receita não informada' }

  const unidadeId = await unidadeDoRegistro('receita', receitaId)
  if (!(await temAcesso(user.id, ['receitas', 'caderno'], { unidadeId })))
    return { error: 'Sem permissão para editar receitas nesta loja' }
  const novaCategoria = parseCategoria(payload.categoria)
  if (!(await podeMexerNoSetor(user.id, receitaId, novaCategoria)))
    return { error: 'Sem permissão para o setor desta receita' }

  const passos = Array.isArray(payload.passos)
    ? payload.passos.filter((p): p is string => typeof p === 'string').map((p) => p.trim().slice(0, 1000)).filter(Boolean)
    : []
  const posInt = (n: number | null) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : null)
  const dif = (['facil', 'media', 'dificil'] as const).includes(payload.dificuldade as 'facil' | 'media' | 'dificil')
    ? payload.dificuldade
    : null
  const obs = typeof payload.observacao === 'string' && payload.observacao.trim() ? payload.observacao.trim().slice(0, 2000) : null

  const { error } = await supabase.from('receita').update({
    categoria: novaCategoria,
    passos,
    tempo_preparo_min: posInt(payload.tempo_preparo_min),
    temperatura_forno: posInt(payload.temperatura_forno),
    tempo_forno_min: posInt(payload.tempo_forno_min),
    dificuldade: dif,
    observacao: obs,
  }).eq('id', receitaId)

  if (error) return { error: 'Erro ao salvar: ' + error.message }

  revalidarReceita(receitaId)
  return { success: true }
}

// ─── Fluxo Caderno → Ficha (revisão pela Natali) ──────────────────────────────

// Marca a receita como "aguardando revisão da Natali" SE quem alterou é da
// produção (não tem a tela de Fichas Técnicas). Mudança da própria Natali não
// dispara aviso pra ela mesma. Chamado após alterações de ingredientes no Caderno.
async function flagRevisaoSeProducao(userId: string, receitaId: string) {
  const ehGestao = await temAcesso(userId, ['receitas'])
  if (ehGestao) return
  const supabase = await createClient()
  await supabase.from('receita').update({ revisao_pendente: true }).eq('id', receitaId)
  revalidatePath('/dashboard/receitas')
}

// Produção cria uma receita nova pelo Caderno. Nasce como 'final', marcada para
// revisão da Natali (conferir ingredientes + precificar). Ingredientes são
// adicionados na sequência, na própria tela do Caderno.
export async function createReceitaCaderno(payload: {
  nome: string
  categoria: string | null
  rendimento: string
  rendimento_unidade: 'g' | 'kg' | 'ml' | 'l' | 'un'
  passos: string[]
  tempo_preparo_min: number | null
  temperatura_forno: number | null
  tempo_forno_min: number | null
  dificuldade: 'facil' | 'media' | 'dificil' | null
  observacao: string | null
}): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const empresaId = await getEmpresaId(user.id)
  if (!empresaId) return { error: 'Empresa não encontrada' }

  const unidadeId = await getUnidadeEscrita(supabase, empresaId)
  if (!(await temAcesso(user.id, ['receitas', 'caderno'], { unidadeId })))
    return { error: 'Sem permissão para criar receitas nesta loja' }

  const categoria = parseCategoria(payload.categoria)
  const permitidos = await setoresPermitidosCaderno(user.id, unidadeId)
  if (permitidos !== null && categoria !== null && !permitidos.includes(categoria))
    return { error: 'Você não tem permissão para criar receitas neste setor' }

  const nome = (payload.nome ?? '').trim()
  if (!nome) return { error: 'Dê um nome à receita' }
  const rendimento = parseDecimalBR(payload.rendimento ?? '')
  if (!(rendimento > 0)) return { error: 'Rendimento deve ser maior que zero' }
  if (!(['g', 'kg', 'ml', 'l', 'un'] as const).includes(payload.rendimento_unidade))
    return { error: 'Unidade de rendimento inválida' }

  const passos = Array.isArray(payload.passos)
    ? payload.passos.filter((p): p is string => typeof p === 'string').map((p) => p.trim().slice(0, 1000)).filter(Boolean)
    : []
  const posInt = (n: number | null) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : null)
  const dif = (['facil', 'media', 'dificil'] as const).includes(payload.dificuldade as 'facil' | 'media' | 'dificil')
    ? payload.dificuldade
    : null
  const obs = typeof payload.observacao === 'string' && payload.observacao.trim() ? payload.observacao.trim().slice(0, 2000) : null

  const { data, error } = await supabase.from('receita').insert({
    nome,
    tipo: 'final',
    categoria,
    rendimento,
    rendimento_unidade: payload.rendimento_unidade,
    passos,
    tempo_preparo_min: posInt(payload.tempo_preparo_min),
    temperatura_forno: posInt(payload.temperatura_forno),
    tempo_forno_min: posInt(payload.tempo_forno_min),
    dificuldade: dif,
    observacao: obs,
    empresa_id: empresaId,
    unidade_id: unidadeId,
    ativo: true,
    revisao_pendente: true,
  }).select('id').single()

  if (error || !data) return { error: 'Erro ao criar receita: ' + (error?.message ?? '') }

  revalidatePath('/dashboard/caderno')
  revalidatePath('/dashboard/receitas')
  return { id: data.id as string }
}

// Natali dá baixa: confere os ingredientes/preço e marca a receita como revisada.
export async function marcarReceitaRevisada(receitaId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const unidadeId = await unidadeDoRegistro('receita', receitaId)
  if (!(await temAcesso(user.id, ['receitas'], { unidadeId })))
    return { error: 'Sem permissão para revisar fichas nesta loja' }

  const { error } = await supabase.from('receita').update({ revisao_pendente: false }).eq('id', receitaId)
  if (error) return { error: 'Erro ao marcar como revisada: ' + error.message }

  revalidatePath('/dashboard/receitas')
  revalidatePath(`/dashboard/receitas/${receitaId}`)
  return { success: true }
}

// Alimenta o campo "Setor": a lista de setores/locais cadastrável (Cadastros →
// Locais, ou o padrão) e quais deles o usuário atual pode usar no Caderno
// (`permitidos` null = todos). Assim a produção só escolhe setores que enxerga.
export async function getSetoresDisponiveis(): Promise<{ locais: string[]; permitidos: string[] | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { locais: [], permitidos: [] }

  const empresaId = await getEmpresaId(user.id)
  let locais: string[] = [...LOCAIS_PADRAO]
  if (empresaId) {
    const { data } = await supabase
      .from('config_geral')
      .select('valor')
      .eq('empresa_id', empresaId)
      .eq('chave', LOCAIS_CONFIG_KEY)
      .maybeSingle()
    const val = data?.valor
    if (Array.isArray(val) && val.length > 0) locais = val as string[]
  }

  const unidadeId = await getUnidadeAutorizada()
  const permitidos = await setoresPermitidosCaderno(user.id, unidadeId)
  return { locais, permitidos }
}

// Contagem de receitas aguardando revisão (badge do menu Fichas). RLS limita à(s) loja(s).
export async function contarReceitasPendentes(): Promise<{ total: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { total: 0 }
  const { count } = await supabase
    .from('receita')
    .select('id', { count: 'exact', head: true })
    .eq('ativo', true)
    .eq('revisao_pendente', true)
  return { total: count ?? 0 }
}
