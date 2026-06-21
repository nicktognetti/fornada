'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
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
  return jar.get(COOKIE_NAME)?.value ?? null
}

// ── Cópia entre unidades ──────────────────────────────────────────────────────

export type TipoCopia = 'fichas' | 'insumos' | 'precos' | 'tudo'

export type CopiarResult = {
  error?: string
  success?: boolean
  copiados?: { fichas?: number; insumos?: number; precos?: number }
}

export async function copiarEntreUnidades(
  deUnidadeId: string,
  paraUnidadeId: string,
  tipo: TipoCopia,
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
    const { data: insumosOrig } = await supabase
      .from('insumo')
      .select('*')
      .eq('unidade_id', deUnidadeId)
      .eq('ativo', true)

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
    const { data: receitasOrig } = await supabase
      .from('receita')
      .select('*, receita_item(*)')
      .eq('unidade_id', deUnidadeId)
      .eq('ativo', true)

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
