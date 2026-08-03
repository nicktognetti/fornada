import { createClient } from '@/lib/supabase/server'
import { getUnidadeAutorizada } from '@/app/actions/unidade'

type Supabase = Awaited<ReturnType<typeof createClient>>

/**
 * Empresa do usuário logado.
 *
 * Estava copiada em 7 arquivos de actions — uma delas usando `.single()`, que
 * lança erro quando o usuário ainda não tem vínculo (o resto usava
 * `.maybeSingle()`). Aqui a resposta é sempre `null` nesse caso.
 *
 * O client é opcional: quem já tem um em mãos passa e evita recriar.
 */
export async function getEmpresaId(userId: string, supabase?: Supabase): Promise<string | null> {
  const sb = supabase ?? (await createClient())
  const { data } = await sb
    .from('usuario_empresa')
    .select('empresa_id')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.empresa_id ?? null
}

/**
 * Loja em que um registro novo deve ser gravado: a unidade AUTORIZADA (cookie
 * validado contra os vínculos do usuário) quando pertence à empresa; senão, a
 * primeira loja ativa da empresa.
 *
 * A permissão de módulo NESTA loja é checada à parte, via `temAcesso`.
 */
export async function getUnidadeEscrita(empresaId: string, supabase?: Supabase): Promise<string | null> {
  const sb = supabase ?? (await createClient())

  const pref = await getUnidadeAutorizada()
  if (pref) {
    const { data } = await sb
      .from('unidade')
      .select('id')
      .eq('id', pref)
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (data) return data.id
  }

  const { data } = await sb
    .from('unidade')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('ativo', true)
    .order('nome')
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}
