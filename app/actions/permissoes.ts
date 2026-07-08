'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { PermissaoMap, Permissao, NivelAcesso } from '@/app/lib/permissions'

type ActionResult<T = void> = T extends void
  ? { error?: string; success?: boolean }
  : { error?: string; data?: T }

// ── Helpers ──────────────────────────────────────────────────────────────────

async function assertAdmin(userId: string): Promise<boolean> {
  // Aceita admin global (tela='*') OU admin de configurações (tela='configuracoes')
  // — ambos têm direito de gerenciar usuários e permissões
  const { data, error } = await supabaseAdmin
    .from('permissao')
    .select('id')
    .eq('usuario_id', userId)
    .in('tela', ['*', 'configuracoes'])
    .eq('acesso', 'admin')
    .is('unidade_id', null)
    .limit(1)
  return !error && Array.isArray(data) && data.length > 0
}

// É admin GLOBAL (tela='*')? Só ele pode conceder/gerenciar admin global —
// impede que um admin "só de Configurações" se auto-promova a admin geral.
async function isAdminGlobal(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('permissao')
    .select('id')
    .eq('usuario_id', userId)
    .eq('tela', '*')
    .eq('acesso', 'admin')
    .is('unidade_id', null)
    .limit(1)
  return Array.isArray(data) && data.length > 0
}

// Empresas às quais um usuário está vinculado (um admin pode gerir mais de uma).
async function empresasDoUsuario(userId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('usuario_empresa')
    .select('empresa_id')
    .eq('user_id', userId)
  return [...new Set(((data ?? []) as { empresa_id: string }[]).map((r) => r.empresa_id))]
}

// O admin pode gerenciar este usuário-alvo? Precisa compartilhar empresa.
// Alvo SEM empresa (órfão) é liberado: não pertence a outra empresa, então
// não há vazamento entre inquilinos — e permite limpeza de órfãos.
async function podeGerenciarUsuario(adminId: string, targetUserId: string): Promise<boolean> {
  if (adminId === targetUserId) return true
  const [minhas, dele] = await Promise.all([
    empresasDoUsuario(adminId),
    empresasDoUsuario(targetUserId),
  ])
  if (dele.length === 0) return true
  const set = new Set(minhas)
  return dele.some((e) => set.has(e))
}

// Unidades que pertencem às empresas do admin — usado para barrar concessão de
// permissões escopadas a lojas de OUTRA empresa.
async function unidadesDasEmpresas(empresaIds: string[]): Promise<Set<string>> {
  if (empresaIds.length === 0) return new Set()
  const { data } = await supabaseAdmin
    .from('unidade')
    .select('id')
    .in('empresa_id', empresaIds)
  return new Set(((data ?? []) as { id: string }[]).map((u) => u.id))
}

// Mantém usuario_unidade (vínculo de LOJA, base do RLS por loja) em sincronia com
// as unidades referenciadas nas permissões do usuário. Aditivo: só adiciona vínculos
// que faltam (não desvincula automaticamente). supabase-js não lança em erro de query.
async function syncUsuarioUnidade(targetUserId: string): Promise<void> {
  const { data: perms } = await supabaseAdmin
    .from('permissao')
    .select('unidade_id')
    .eq('usuario_id', targetUserId)

  const permList = (perms ?? []) as { unidade_id: string | null }[]
  const hasGlobal = permList.some((p) => p.unidade_id === null)

  let desejadas: string[]

  if (hasGlobal) {
    // Permissão global (unidade_id=NULL): vincular a TODAS as unidades ativas da empresa
    const { data: ue } = await supabaseAdmin
      .from('usuario_empresa')
      .select('empresa_id')
      .eq('user_id', targetUserId)
      .maybeSingle()
    if (!ue?.empresa_id) return

    const { data: todas } = await supabaseAdmin
      .from('unidade')
      .select('id')
      .eq('empresa_id', ue.empresa_id)
      .eq('ativo', true)
    desejadas = ((todas ?? []) as { id: string }[]).map((u) => u.id)
  } else {
    desejadas = [...new Set(
      permList.map((p) => p.unidade_id).filter((id): id is string => !!id)
    )]
  }

  const desejadaSet = new Set(desejadas)

  const { data: existentes } = await supabaseAdmin
    .from('usuario_unidade')
    .select('unidade_id')
    .eq('user_id', targetUserId)
  const jaTem = new Set(((existentes ?? []) as { unidade_id: string }[]).map((r) => r.unidade_id))

  // Adiciona unidades novas
  const novas = desejadas.filter((id) => !jaTem.has(id))
  if (novas.length > 0) {
    await supabaseAdmin
      .from('usuario_unidade')
      .insert(novas.map((unidade_id) => ({ user_id: targetUserId, unidade_id })))
  }

  // Remove unidades que o usuário não tem mais permissão
  const obsoletas = [...jaTem].filter((id) => !desejadaSet.has(id))
  if (obsoletas.length > 0) {
    await supabaseAdmin
      .from('usuario_unidade')
      .delete()
      .eq('user_id', targetUserId)
      .in('unidade_id', obsoletas)
  }
}

// ── Leitura das próprias permissões ─────────────────────────────────────────

export async function getUserPermissionsAction(): Promise<ActionResult<PermissaoMap>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { data, error } = await supabase
    .from('permissao')
    .select('tela, acesso, unidade_id')
    .eq('usuario_id', user.id)

  if (error) return { error: error.message }

  const map: PermissaoMap = {}
  for (const row of (data ?? []) as Permissao[]) {
    map[row.tela] = row
  }
  return { data: map }
}

// ── Salvar permissões de um usuário ─────────────────────────────────────────

export interface PermissaoInput {
  usuario_id: string
  tela: string
  acesso: NivelAcesso
  unidade_id: string | null
  // Só p/ a tela 'caderno': setores liberados. null/omisso = todos.
  locais?: string[] | null
}

// userId e unidadeId explícitos: garante o DELETE mesmo quando permissoes=[].
// Caso contrário, antigas permissões globais ficam no banco e o seletor mostra tabs errados.
export async function savePermissionsAction(
  targetUserId: string,
  unidadeId: string | null,
  permissoes: PermissaoInput[]
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!(await assertAdmin(user.id))) return { error: 'Acesso negado' }
  if (!(await podeGerenciarUsuario(user.id, targetUserId)))
    return { error: 'Usuário não pertence à sua empresa' }

  // Só admin global concede admin global (tela='*') — barra auto-promoção.
  if (permissoes.some((p) => p.tela === '*') && !(await isAdminGlobal(user.id)))
    return { error: 'Apenas um administrador geral pode conceder acesso de administrador geral' }

  // Permissões escopadas a loja só podem apontar para unidades das empresas do admin.
  const unidadesAlvo = [
    ...new Set([unidadeId, ...permissoes.map((p) => p.unidade_id)].filter((u): u is string => !!u)),
  ]
  if (unidadesAlvo.length > 0) {
    const permitidas = await unidadesDasEmpresas(await empresasDoUsuario(user.id))
    if (unidadesAlvo.some((u) => !permitidas.has(u)))
      return { error: 'Uma das lojas informadas não pertence à sua empresa' }
  }

  // DELETE do escopo atual (sempre — mesmo que permissoes seja vazio, limpa o escopo)
  let deleteQ = supabaseAdmin
    .from('permissao')
    .delete()
    .eq('usuario_id', targetUserId)
  deleteQ = unidadeId === null
    ? deleteQ.is('unidade_id', null)
    : deleteQ.eq('unidade_id', unidadeId)
  const { error: delErr } = await deleteQ
  if (delErr) return { error: delErr.message }

  // INSERT apenas as permissões ativas (pode ser vazio = limpar o escopo)
  if (permissoes.length > 0) {
    const { error } = await supabaseAdmin.from('permissao').insert(permissoes)
    if (error) return { error: error.message }
  }

  await syncUsuarioUnidade(targetUserId)

  revalidatePath('/dashboard/configuracoes')
  return { success: true }
}

// ── Deletar permissão específica ─────────────────────────────────────────────

export async function deletePermissionAction(
  targetUserId: string,
  tela: string,
  unidadeId: string | null
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!(await assertAdmin(user.id))) return { error: 'Acesso negado' }
  if (!(await podeGerenciarUsuario(user.id, targetUserId)))
    return { error: 'Usuário não pertence à sua empresa' }

  let q = supabaseAdmin
    .from('permissao')
    .delete()
    .eq('usuario_id', targetUserId)
    .eq('tela', tela)

  q = unidadeId === null ? q.is('unidade_id', null) : q.eq('unidade_id', unidadeId)

  const { error } = await q
  if (error) return { error: error.message }

  revalidatePath('/dashboard/configuracoes')
  return { success: true }
}

// ── Desabilitar usuário: remove TODAS as permissões ──────────────────────────

export async function disableUserAction(targetUserId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (targetUserId === user.id) return { error: 'Você não pode desabilitar a si mesmo' }
  if (!(await assertAdmin(user.id))) return { error: 'Acesso negado' }
  if (!(await podeGerenciarUsuario(user.id, targetUserId)))
    return { error: 'Usuário não pertence à sua empresa' }

  const { error } = await supabaseAdmin
    .from('permissao')
    .delete()
    .eq('usuario_id', targetUserId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/configuracoes')
  return { success: true }
}

// ── Excluir usuário permanentemente ──────────────────────────────────────────

export async function deleteUserAction(targetUserId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (targetUserId === user.id) return { error: 'Você não pode excluir a si mesmo' }
  if (!(await assertAdmin(user.id))) return { error: 'Acesso negado' }
  if (!(await podeGerenciarUsuario(user.id, targetUserId)))
    return { error: 'Usuário não pertence à sua empresa' }

  // Tenta remover do Auth; se "not found" o usuário já foi deletado — continua limpeza
  const { error } = await supabaseAdmin.auth.admin.deleteUser(targetUserId)
  if (error && !error.message.toLowerCase().includes('not found')) return { error: error.message }

  // Limpeza manual caso a cascata não tenha funcionado (ex: usuário orphan)
  await supabaseAdmin.from('permissao').delete().eq('usuario_id', targetUserId)
  await supabaseAdmin.from('usuario_unidade').delete().eq('user_id', targetUserId)
  await supabaseAdmin.from('usuario_empresa').delete().eq('user_id', targetUserId)

  revalidatePath('/dashboard/configuracoes')
  return { success: true }
}

// ── Resetar senha ─────────────────────────────────────────────────────────────

export async function resetPasswordAction(
  targetUserId: string,
  newPassword: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!(await assertAdmin(user.id))) return { error: 'Acesso negado' }
  if (!(await podeGerenciarUsuario(user.id, targetUserId)))
    return { error: 'Usuário não pertence à sua empresa' }
  if (newPassword.length < 6) return { error: 'Senha deve ter pelo menos 6 caracteres' }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
    password: newPassword,
  })

  if (error) return { error: error.message }
  return { success: true }
}

// ── Criar novo usuário ────────────────────────────────────────────────────────

export type PermissaoInicialInput =
  | { tipo: 'admin_global' }
  | { tipo: 'personalizado'; permissoes: { tela: string; acesso: NivelAcesso; unidade_id?: string | null; locais?: string[] | null }[] }

export async function createUserAction(
  email: string,
  password: string,
  nome: string,
  permissaoInicial: PermissaoInicialInput = { tipo: 'admin_global' }
): Promise<ActionResult<{ id: string; email: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!(await assertAdmin(user.id))) return { error: 'Acesso negado' }

  // Só admin global cria admin global — barra escalonamento de privilégio.
  const criaAdminGlobal =
    permissaoInicial.tipo === 'admin_global' ||
    (permissaoInicial.tipo === 'personalizado' && permissaoInicial.permissoes.some((p) => p.tela === '*'))
  if (criaAdminGlobal && !(await isAdminGlobal(user.id)))
    return { error: 'Apenas um administrador geral pode criar outro administrador geral' }

  // Permissões personalizadas escopadas a loja só podem apontar para unidades das
  // empresas do admin (o novo usuário será vinculado à empresa do criador).
  if (permissaoInicial.tipo === 'personalizado') {
    const unidadesAlvo = [
      ...new Set(permissaoInicial.permissoes.map((p) => p.unidade_id).filter((u): u is string => !!u)),
    ]
    if (unidadesAlvo.length > 0) {
      const permitidas = await unidadesDasEmpresas(await empresasDoUsuario(user.id))
      if (unidadesAlvo.some((u) => !permitidas.has(u)))
        return { error: 'Uma das lojas informadas não pertence à sua empresa' }
    }
  }

  // 1. Criar usuário via service_role (bypassa RLS)
  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    user_metadata: { nome },
    email_confirm: true,
  })

  if (createError || !created.user) return { error: createError?.message ?? 'Erro ao criar usuário' }

  const newUserId = created.user.id

  try {
    // 2. Vincular à empresa do admin criador
    const { data: ue } = await supabase
      .from('usuario_empresa')
      .select('empresa_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (ue?.empresa_id) {
      await supabaseAdmin
        .from('usuario_empresa')
        .insert({ user_id: newUserId, empresa_id: ue.empresa_id })
    }

    // 3. Inserir permissões iniciais
    if (permissaoInicial.tipo === 'admin_global') {
      await supabaseAdmin
        .from('permissao')
        .insert({ usuario_id: newUserId, tela: '*', acesso: 'admin', unidade_id: null })
    } else {
      const rows = permissaoInicial.permissoes.map((p) => ({
        usuario_id: newUserId,
        tela: p.tela,
        acesso: p.acesso,
        unidade_id: p.unidade_id ?? null,
        locais: p.locais ?? null,
      }))
      if (rows.length > 0) {
        await supabaseAdmin.from('permissao').insert(rows)
      }
    }

    // 4. Vincular loja(s) (usuario_unidade) — base do RLS por loja
    await syncUsuarioUnidade(newUserId)
  } catch {
    // Rollback: remover usuário criado para não deixar órfão
    await supabaseAdmin.auth.admin.deleteUser(newUserId)
    return { error: 'Falha ao configurar permissões. Usuário não criado.' }
  }

  revalidatePath('/dashboard/configuracoes')
  return { data: { id: newUserId, email } }
}

// ── Listar unidades gerenciáveis (das empresas do admin) ─────────────────────

export async function getUnidadesGerenciaveis(): Promise<ActionResult<{ id: string; nome: string }[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!(await assertAdmin(user.id))) return { error: 'Acesso negado' }

  const { data: ue } = await supabase
    .from('usuario_empresa')
    .select('empresa_id')
    .eq('user_id', user.id)
  const empresaIds = (ue ?? []).map((r: { empresa_id: string }) => r.empresa_id)
  if (empresaIds.length === 0) return { data: [] }

  const { data: unidades } = await supabaseAdmin
    .from('unidade')
    .select('id, nome')
    .in('empresa_id', empresaIds)
    .eq('ativo', true)
    .order('nome')

  return { data: (unidades ?? []) as { id: string; nome: string }[] }
}

// ── Listar usuários com permissões ───────────────────────────────────────────

export type UsuarioComPermissoes = {
  id: string
  email: string
  nome: string
  isAdminGlobal: boolean
  permissoes: Permissao[]
  criadoEm: string
}

export async function listUsersWithPermissionsAction(): Promise<
  ActionResult<UsuarioComPermissoes[]>
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!(await assertAdmin(user.id))) return { error: 'Acesso negado' }

  // Busca empresa do admin logado
  const { data: ue } = await supabase
    .from('usuario_empresa')
    .select('empresa_id')
    .eq('user_id', user.id)
    .single()

  const empresaId = ue?.empresa_id

  // IDs dos usuários desta empresa
  let userIds: string[] = []
  if (empresaId) {
    const { data: ueRows } = await supabaseAdmin
      .from('usuario_empresa')
      .select('user_id')
      .eq('empresa_id', empresaId)

    userIds = (ueRows ?? []).map((r: { user_id: string }) => r.user_id)
  }

  if (userIds.length === 0) return { data: [] }

  // Permissões de todos eles (via admin para ver além do RLS)
  const { data: permRows } = await supabaseAdmin
    .from('permissao')
    .select('usuario_id, tela, acesso, unidade_id, locais')
    .in('usuario_id', userIds)

  // Auth users para email + nome + criadoEm
  const { data: authData } = await supabaseAdmin.auth.admin.listUsers()
  const authMap = new Map(
    (authData?.users ?? []).map((u) => [u.id, {
      email: u.email ?? '',
      nome: (u.user_metadata?.nome as string | undefined) ?? '',
      criadoEm: u.created_at,
    }])
  )

  const permsByUser = new Map<string, Permissao[]>()
  for (const row of (permRows ?? []) as (Permissao & { usuario_id: string })[]) {
    const list = permsByUser.get(row.usuario_id) ?? []
    list.push({ tela: row.tela, acesso: row.acesso, unidade_id: row.unidade_id, locais: row.locais ?? null })
    permsByUser.set(row.usuario_id, list)
  }

  const result: UsuarioComPermissoes[] = userIds.map((id) => {
    const auth = authMap.get(id)
    const perms = permsByUser.get(id) ?? []
    return {
      id,
      email: auth?.email ?? id,
      nome: auth?.nome ?? '',
      isAdminGlobal: perms.some((p) => p.tela === '*' && p.acesso === 'admin' && p.unidade_id === null),
      permissoes: perms,
      criadoEm: auth?.criadoEm ?? '',
    }
  })

  return { data: result }
}
