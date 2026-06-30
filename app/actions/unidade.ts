'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

const COOKIE_NAME = 'unidade_preferida'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 ano

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface UnidadeOption {
  id: string
  nome: string
}

// ── Unidades do usuário ───────────────────────────────────────────────────────

export async function getUserUnidadesAction(): Promise<UnidadeOption[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: vinculos } = await supabase
    .from('usuario_unidade')
    .select('unidade_id')
    .eq('user_id', user.id)
    .order('created_at')

  if (!vinculos || vinculos.length === 0) return []

  const ids = vinculos.map((v: { unidade_id: string }) => v.unidade_id)

  const { data: unidades } = await supabase
    .from('unidade')
    .select('id, nome')
    .in('id', ids)
    .order('nome')

  return (unidades ?? []) as UnidadeOption[]
}

// ── Cookie de unidade preferida ───────────────────────────────────────────────

export async function setUnidadeCookieAction(unidadeId: string | null): Promise<void> {
  const jar = await cookies()
  if (unidadeId) {
    jar.set(COOKIE_NAME, unidadeId, {
      maxAge: COOKIE_MAX_AGE,
      path: '/',
      sameSite: 'lax',
    })
  } else {
    jar.delete(COOKIE_NAME)
  }
}

export async function getUnidadePreferida(): Promise<string | null> {
  const jar = await cookies()
  const cookieVal = jar.get(COOKIE_NAME)?.value
  if (cookieVal) return cookieVal
  // Sem cookie: padrão = PRIMEIRA loja do usuário (nunca "todas" — as lojas são
  // isoladas; sempre uma loja selecionada por vez).
  const unidades = await getUserUnidadesAction()
  return unidades[0]?.id ?? null
}

/**
 * Unidade ativa AUTORIZADA para o usuário logado.
 *
 * Diferente de `getUnidadePreferida()` (que devolve o cookie cru, manipulável),
 * esta função VALIDA o valor contra `usuario_unidade`. É a fonte de verdade que
 * deve ser usada por toda página/action que decide QUAL loja o usuário está
 * operando — especialmente quando a consulta usa `supabaseAdmin` (bypassa RLS) e
 * o filtro de loja é a única barreira de isolamento.
 *
 * Regras:
 * - Admin global → o cookie é aceito como veio (vê todas as lojas).
 * - Demais → o cookie só vale se estiver entre os vínculos do usuário em
 *   `usuario_unidade`; caso contrário, cai para a PRIMEIRA loja vinculada.
 * - Sem vínculo nenhum (desabilitado) → `null`.
 *
 * Usar SOMENTE em Server Components/Actions (depende de `next/headers`).
 */
export async function getUnidadeAutorizada(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const jar = await cookies()
  const cookieVal = jar.get(COOKIE_NAME)?.value ?? null

  // Admin global vê todas as lojas: aceita o cookie como veio.
  const { data: adminRows } = await supabaseAdmin
    .from('permissao')
    .select('id')
    .eq('usuario_id', user.id)
    .eq('tela', '*')
    .eq('acesso', 'admin')
    .is('unidade_id', null)
    .limit(1)
  if (adminRows && adminRows.length > 0) return cookieVal

  // Demais: o cookie precisa estar entre os vínculos reais.
  const { data: vinculos } = await supabaseAdmin
    .from('usuario_unidade')
    .select('unidade_id')
    .eq('user_id', user.id)
    .order('created_at')
  const ids = (vinculos ?? []).map((v: { unidade_id: string }) => v.unidade_id)

  if (cookieVal && ids.includes(cookieVal)) return cookieVal
  return ids[0] ?? null
}

// ── Cópia entre unidades ──────────────────────────────────────────────────────

export type TipoCopia = 'fichas' | 'insumos' | 'precos' | 'tudo'

export type CopiarResult = {
  error?: string
  success?: boolean
  copiados?: { fichas?: number; insumos?: number; precos?: number }
}

// Seletor opcional: quando informado, copia só os itens escolhidos (por id).
// Sem seletor, mantém o comportamento antigo (copia tudo do tipo).
export type CopiaSeletor = { insumoIds?: string[]; receitaIds?: string[] }

export async function copiarEntreUnidades(
  deUnidadeId: string,
  paraUnidadeId: string,
  tipo: TipoCopia,
  seletor?: CopiaSeletor,
): Promise<CopiarResult> {
  if (deUnidadeId === paraUnidadeId) return { error: 'Origem e destino são a mesma unidade' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  // Verifica que o usuário tem acesso a pelo menos uma empresa
  const { data: acessos } = await supabase
    .from('usuario_empresa')
    .select('empresa_id')
    .eq('user_id', user.id)
  if (!acessos || acessos.length === 0) return { error: 'Acesso negado' }

  const empresaIds = new Set(acessos.map((a: { empresa_id: string }) => a.empresa_id))

  const { data: unidades } = await supabase
    .from('unidade')
    .select('id, empresa_id')
    .in('id', [deUnidadeId, paraUnidadeId])
  const unidadesOk = (unidades ?? []).filter((u: { id: string; empresa_id: string }) => empresaIds.has(u.empresa_id))
  if (unidadesOk.length < 2) return { error: 'Unidades inválidas para este usuário' }
  // Garante que ambas pertencem à mesma empresa
  const empresaUnidades = new Set(unidadesOk.map((u: { empresa_id: string }) => u.empresa_id))
  if (empresaUnidades.size > 1) return { error: 'Unidades de empresas diferentes' }

  const copiados: { fichas?: number; insumos?: number; precos?: number } = {}

  // ── Copiar Insumos ────────────────────────────────────────────────────────
  if (tipo === 'insumos' || tipo === 'tudo') {
    let insumoQ = supabase
      .from('insumo')
      .select('*')
      .eq('unidade_id', deUnidadeId)
      .eq('ativo', true)
    if (seletor?.insumoIds && seletor.insumoIds.length > 0) insumoQ = insumoQ.in('id', seletor.insumoIds)
    const { data: insumosOrig } = await insumoQ

    if (insumosOrig && insumosOrig.length > 0) {
      const { data: existentes } = await supabase
        .from('insumo')
        .select('nome')
        .eq('unidade_id', paraUnidadeId)
      const nomesExistentes = new Set((existentes ?? []).map((e: { nome: string }) => e.nome))

      const novos = insumosOrig
        .filter((i: { nome: string }) => !nomesExistentes.has(i.nome))
        .map((insumo: { id: string; [k: string]: unknown }) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, ...rest } = insumo
          return { ...rest, unidade_id: paraUnidadeId }
        })

      if (novos.length > 0) {
        const { data: insertados, error } = await supabase
          .from('insumo')
          .insert(novos)
          .select('id')
        if (error) return { error: `Erro ao copiar insumos: ${error.message}` }
        copiados.insumos = insertados?.length ?? 0
      } else {
        copiados.insumos = 0
      }
    } else {
      copiados.insumos = 0
    }
  }

  // ── Copiar Fichas Técnicas ────────────────────────────────────────────────
  if (tipo === 'fichas' || tipo === 'tudo') {
    let receitaQ = supabase
      .from('receita')
      .select('*, receita_item(*)')
      .eq('unidade_id', deUnidadeId)
      .eq('ativo', true)
    if (seletor?.receitaIds && seletor.receitaIds.length > 0) receitaQ = receitaQ.in('id', seletor.receitaIds)
    const { data: receitasOrig } = await receitaQ

    if (receitasOrig && receitasOrig.length > 0) {
      const { data: existentes } = await supabase
        .from('receita')
        .select('nome')
        .eq('unidade_id', paraUnidadeId)
      const nomesExistentes = new Set((existentes ?? []).map((e: { nome: string }) => e.nome))

      let fichasCriadas = 0

      for (const receita of receitasOrig) {
        if (nomesExistentes.has(receita.nome)) continue

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { receita_item: itens, id, ...receitaData } = receita as {
          id: string
          receita_item: Array<Record<string, unknown>>
          [k: string]: unknown
        }
        const { data: novaReceita, error: errR } = await supabase
          .from('receita')
          .insert({ ...receitaData, unidade_id: paraUnidadeId })
          .select('id')
          .single()
        if (errR || !novaReceita) continue

        if (Array.isArray(itens) && itens.length > 0) {
          const novosItens = itens.map((item: Record<string, unknown>) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id: _iid, receita_id: _rid, ...rest } = item
            return { ...rest, receita_id: novaReceita.id }
          })
          await supabase.from('receita_item').insert(novosItens)
        }

        fichasCriadas++
      }

      copiados.fichas = fichasCriadas
    } else {
      copiados.fichas = 0
    }
  }

  // ── Copiar Preços ─────────────────────────────────────────────────────────
  // Usa produto_preco (modelo atual). Copia via nome do produto como chave de correspondência.
  if (tipo === 'precos' || tipo === 'tudo') {
    const { data: produtosOrigem } = await supabase
      .from('produto')
      .select('id, nome')
      .eq('unidade_id', deUnidadeId)
      .eq('ativo', true)

    const { data: produtosDestino } = await supabase
      .from('produto')
      .select('id, nome, unidade_id')
      .eq('unidade_id', paraUnidadeId)
      .eq('ativo', true)

    if (produtosOrigem && produtosDestino && produtosOrigem.length > 0) {
      const idsOrigem = produtosOrigem.map((p: { id: string }) => p.id)
      const { data: precos } = await supabase
        .from('produto_preco')
        .select('produto_id, preco_praticado')
        .in('produto_id', idsOrigem)
        .gt('preco_praticado', 0)

      if (precos && precos.length > 0) {
        type ProdRow = { id: string; nome: string; unidade_id?: string | null }
        type PrecoRow = { produto_id: string; preco_praticado: number }

        const nomeParaProdDestino = new Map(
          (produtosDestino as ProdRow[]).map((p) => [p.nome, p])
        )
        const idParaNome = new Map(
          (produtosOrigem as ProdRow[]).map((p) => [p.id, p.nome])
        )

        const upserts: { produto_id: string; unidade_id: string; preco_praticado: number; volume_mensal: number }[] = []
        for (const p of precos as PrecoRow[]) {
          const nome = idParaNome.get(p.produto_id)
          if (!nome) continue
          const dest = nomeParaProdDestino.get(nome)
          if (!dest?.unidade_id) continue
          upserts.push({
            produto_id: dest.id,
            unidade_id: dest.unidade_id,
            preco_praticado: p.preco_praticado,
            volume_mensal: 0,
          })
        }

        if (upserts.length > 0) {
          const { data: ups, error: errP } = await supabase
            .from('produto_preco')
            .upsert(upserts, { onConflict: 'produto_id,unidade_id' })
            .select('produto_id')
          if (errP) return { error: `Erro ao copiar preços: ${errP.message}` }
          copiados.precos = ups?.length ?? 0
        } else {
          copiados.precos = 0
        }
      } else {
        copiados.precos = 0
      }
    } else {
      copiados.precos = 0
    }
  }

  revalidatePath('/dashboard', 'layout')
  return { success: true, copiados }
}

// ── Listar itens copiáveis (para seleção no modal) ──────────────────────────────

export type ItemCopiavel = { id: string; nome: string; grupo: string; jaExiste: boolean }

export async function getItensParaCopiar(
  deUnidadeId: string,
  paraUnidadeId: string,
  tipo: 'insumos' | 'fichas',
): Promise<{ error?: string; itens?: ItemCopiavel[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const tabela = tipo === 'insumos' ? 'insumo' : 'receita'
  const campoGrupo = tipo === 'insumos' ? 'categoria' : 'tipo'

  const [origem, destino] = await Promise.all([
    supabase.from(tabela).select(`id, nome, ${campoGrupo}`).eq('unidade_id', deUnidadeId).eq('ativo', true).order('nome'),
    supabase.from(tabela).select('nome').eq('unidade_id', paraUnidadeId).eq('ativo', true),
  ])
  if (origem.error) return { error: origem.error.message }

  const existentes = new Set((destino.data ?? []).map((d: { nome: string }) => d.nome))
  const TIPO_LABEL: Record<string, string> = { final: 'Produto (final)', base: 'Base' }

  const itens: ItemCopiavel[] = ((origem.data ?? []) as Record<string, unknown>[]).map((r) => {
    const grupoRaw = (r[campoGrupo] as string | null) ?? null
    const grupo = tipo === 'fichas' ? (TIPO_LABEL[grupoRaw ?? ''] ?? grupoRaw ?? '—') : (grupoRaw ?? 'Sem categoria')
    return { id: r.id as string, nome: r.nome as string, grupo, jaExiste: existentes.has(r.nome as string) }
  })
  return { itens }
}
