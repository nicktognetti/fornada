import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

type Nivel = 'leitura' | 'escrita' | 'admin'
const RANK: Record<string, number> = { leitura: 1, escrita: 2, admin: 3 }

/**
 * Autorização server-side baseada na tabela `permissao` (RBAC).
 *
 * Retorna `true` se o usuário tem acesso a **pelo menos uma** das `telas` no
 * nível mínimo `nivel` (padrão `'escrita'`).
 *
 * - Admin global (`tela='*'`, `acesso='admin'`, `unidade_id=null`) sempre passa.
 * - Se `unidadeId` for informado, a permissão precisa ser **global**
 *   (`unidade_id = null`) ou da **mesma unidade**.
 * - Usuário sem permissões (ex.: desabilitado) → `false`.
 *
 * Usar SOMENTE em Server Actions (depende de `next/headers`).
 */
export async function temAcesso(
  userId: string,
  telas: string[],
  opts?: { unidadeId?: string | null; nivel?: Nivel },
): Promise<boolean> {
  const nivel = opts?.nivel ?? 'escrita'
  const supabase = await createClient()
  const { data } = await supabase
    .from('permissao')
    .select('tela, acesso, unidade_id')
    .eq('usuario_id', userId)

  const lista = (data ?? []) as { tela: string; acesso: string; unidade_id: string | null }[]

  // Admin global sobrepõe tudo
  if (lista.some((p) => p.tela === '*' && p.acesso === 'admin' && p.unidade_id === null)) {
    return true
  }

  return lista.some(
    (p) =>
      telas.includes(p.tela) &&
      (RANK[p.acesso] ?? 0) >= RANK[nivel] &&
      (p.unidade_id === null || opts?.unidadeId == null || p.unidade_id === opts.unidadeId),
  )
}

/**
 * `unidade_id` de um registro de negócio, para checagem de permissão por loja.
 *
 * Usa `supabaseAdmin` de propósito: precisamos saber a loja REAL do registro
 * mesmo que o usuário não tenha vínculo com ela (para então NEGAR via `temAcesso`).
 * Se lêssemos com o cliente autenticado, a RLS esconderia o registro e a unidade
 * viria `null` — o que faria `temAcesso` liberar (null = qualquer loja).
 *
 * Retorna `null` se o registro não existe. Usar SOMENTE em Server Actions.
 */
export async function unidadeDoRegistro(
  table: 'insumo' | 'receita' | 'produto',
  id: string,
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from(table)
    .select('unidade_id')
    .eq('id', id)
    .maybeSingle()
  return (data?.unidade_id as string | null) ?? null
}
