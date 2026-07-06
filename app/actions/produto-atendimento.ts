'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { temAcesso } from '@/app/lib/authz'
import { revalidatePath } from 'next/cache'

/**
 * Campos do produto usados pelo agente WhatsApp (módulo Atendimento — Fase 1).
 * Ver migration 20260705000000_atendimento_fase1.sql.
 */
export type ProdutoAtendimento = {
  /** Produto "de sempre" (pão francês): sempre disponível, sem toggle diário. */
  sempre_disponivel: boolean
  /** Toggle diário tem/acabou. null = não informado (agente confirma com a equipe). */
  disponivel_hoje: boolean | null
  /** URL pública da foto que o agente envia no WhatsApp. */
  foto_url: string | null
  /** ⭐ O agente só oferece espontaneamente produtos marcados aqui. */
  sugestao_do_dia: boolean
  /** O agente de DELIVERY vende este produto (padrão: sim). */
  vende_delivery: boolean
  /** O agente de ENCOMENDAS vende este produto (padrão: não — só os específicos). */
  vende_encomenda: boolean
}

type ActionResult<T = void> = T extends void
  ? { error?: string; success?: boolean }
  : { error?: string; data?: T }

const BUCKET_FOTOS = 'produto-fotos'
const FOTO_MAX_BYTES = 5 * 1024 * 1024
const FOTO_TIPOS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

// Loja real do produto via service role (RLS esconderia o registro e a checagem
// de permissão liberaria por engano) + dados necessários para foto.
async function getProdutoReal(produtoId: string) {
  const { data } = await supabaseAdmin
    .from('produto')
    .select('id, empresa_id, unidade_id, foto_url')
    .eq('id', produtoId)
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

function revalidar() {
  revalidatePath('/dashboard/produtos')
  revalidatePath('/dashboard/painel')
}

// ── setProdutoAtendimento ─────────────────────────────────────────────────────
// Atualiza os flags de disponibilidade/sugestão (toggle diário tem/acabou,
// "de sempre" e ⭐ sugestão do dia).
export async function setProdutoAtendimento(
  produtoId: string,
  patch: {
    sempre_disponivel?: boolean
    disponivel_hoje?: boolean | null
    sugestao_do_dia?: boolean
    vende_delivery?: boolean
    vende_encomenda?: boolean
  },
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const prod = await getProdutoReal(produtoId)
  if (!prod) return { error: 'Produto não encontrado' }
  if (!(await temAcesso(user.id, ['produtos', 'atendimento'], { unidadeId: prod.unidade_id })))
    return { error: 'Sem permissão para alterar a disponibilidade nesta loja' }

  const update: Record<string, boolean | null> = {}
  if (patch.sempre_disponivel !== undefined) update.sempre_disponivel = patch.sempre_disponivel
  if (patch.disponivel_hoje !== undefined) update.disponivel_hoje = patch.disponivel_hoje
  if (patch.sugestao_do_dia !== undefined) update.sugestao_do_dia = patch.sugestao_do_dia
  if (patch.vende_delivery !== undefined) update.vende_delivery = patch.vende_delivery
  if (patch.vende_encomenda !== undefined) update.vende_encomenda = patch.vende_encomenda
  if (Object.keys(update).length === 0) return { success: true }

  const { error } = await supabase.from('produto').update(update).eq('id', produtoId)
  if (error) return { error: error.message }

  revalidar()
  return { success: true }
}

// ── setProdutoCanaisLote ──────────────────────────────────────────────────────
// Marca/desmarca canais de venda (Delivery/Encomendas) para VÁRIOS produtos de
// uma vez — pedido da Natali: marcar os "de encomenda" sem abrir um por um.
export async function setProdutoCanaisLote(
  produtoIds: string[],
  patch: { vende_delivery?: boolean; vende_encomenda?: boolean },
): Promise<ActionResult<{ atualizados: number; semPermissao: number }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (produtoIds.length === 0) return { data: { atualizados: 0, semPermissao: 0 } }

  const update: Record<string, boolean> = {}
  if (patch.vende_delivery !== undefined) update.vende_delivery = patch.vende_delivery
  if (patch.vende_encomenda !== undefined) update.vende_encomenda = patch.vende_encomenda
  if (Object.keys(update).length === 0) return { data: { atualizados: 0, semPermissao: 0 } }

  // Loja real de cada produto via service role (RLS esconderia e liberaria por engano)
  const { data: prods } = await supabaseAdmin
    .from('produto')
    .select('id, unidade_id')
    .in('id', produtoIds)
  const rows = (prods ?? []) as { id: string; unidade_id: string | null }[]

  // Permissão checada 1× por loja presente no lote
  const unidades = [...new Set(rows.map((p) => p.unidade_id).filter((u): u is string => !!u))]
  const permitidas = new Set<string>()
  for (const uid of unidades) {
    if (await temAcesso(user.id, ['produtos', 'atendimento'], { unidadeId: uid })) permitidas.add(uid)
  }

  const ids = rows.filter((p) => p.unidade_id && permitidas.has(p.unidade_id)).map((p) => p.id)
  const semPermissao = produtoIds.length - ids.length
  if (ids.length === 0) return { error: 'Sem permissão para alterar estes produtos' }

  const { error } = await supabase.from('produto').update(update).in('id', ids)
  if (error) return { error: error.message }

  revalidar()
  return { data: { atualizados: ids.length, semPermissao } }
}

// ── uploadProdutoFoto ─────────────────────────────────────────────────────────
// Sobe a foto para o bucket público `produto-fotos` e grava a URL no produto.
// FormData com campo `foto` (jpeg/png/webp, máx. 5 MB).
export async function uploadProdutoFoto(
  produtoId: string,
  formData: FormData,
): Promise<ActionResult<{ foto_url: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const file = formData.get('foto')
  if (!(file instanceof File) || file.size === 0) return { error: 'Selecione uma imagem' }
  const ext = FOTO_TIPOS[file.type]
  if (!ext) return { error: 'Formato não suportado — use JPG, PNG ou WebP' }
  if (file.size > FOTO_MAX_BYTES) return { error: 'Imagem muito grande (máx. 5 MB)' }

  const prod = await getProdutoReal(produtoId)
  if (!prod) return { error: 'Produto não encontrado' }
  if (!(await temAcesso(user.id, ['produtos', 'atendimento'], { unidadeId: prod.unidade_id })))
    return { error: 'Sem permissão para alterar produtos nesta loja' }

  // Nome com timestamp: evita cache velho no WhatsApp/navegador ao trocar a foto.
  const path = `${prod.empresa_id}/${produtoId}-${Date.now()}.${ext}`
  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET_FOTOS)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: true })
  if (upErr) return { error: `Falha no upload: ${upErr.message}` }

  const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET_FOTOS).getPublicUrl(path)

  const { error } = await supabase.from('produto').update({ foto_url: publicUrl }).eq('id', produtoId)
  if (error) return { error: error.message }

  // Remove a foto anterior (se houver) — falha aqui não é fatal.
  const antiga = pathDaFotoUrl(prod.foto_url)
  if (antiga && antiga !== path) await supabaseAdmin.storage.from(BUCKET_FOTOS).remove([antiga])

  revalidar()
  return { data: { foto_url: publicUrl } }
}

// ── removeProdutoFoto ─────────────────────────────────────────────────────────
export async function removeProdutoFoto(produtoId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const prod = await getProdutoReal(produtoId)
  if (!prod) return { error: 'Produto não encontrado' }
  if (!(await temAcesso(user.id, ['produtos', 'atendimento'], { unidadeId: prod.unidade_id })))
    return { error: 'Sem permissão para alterar produtos nesta loja' }

  const { error } = await supabase.from('produto').update({ foto_url: null }).eq('id', produtoId)
  if (error) return { error: error.message }

  const path = pathDaFotoUrl(prod.foto_url)
  if (path) await supabaseAdmin.storage.from(BUCKET_FOTOS).remove([path])

  revalidar()
  return { success: true }
}
