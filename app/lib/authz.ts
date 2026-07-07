import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { avaliaAcesso, type Nivel } from './authz-core'

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
  const supabase = await createClient()
  const { data } = await supabase
    .from('permissao')
    .select('tela, acesso, unidade_id')
    .eq('usuario_id', userId)

  const lista = (data ?? []) as { tela: string; acesso: string; unidade_id: string | null }[]
  return avaliaAcesso(lista, telas, opts)
}

/**
 * Quem pode ver VALORES (custo/preço/margem) na tela de Produtos.
 *
 * Regra: nível ADMIN na tela produtos, OU qualquer acesso a precos/painel
 * (nessas telas os valores aparecem de qualquer jeito). Quem tem só
 * escrita/leitura em produtos (operação: tem/acabou, foto, canais do robô)
 * trabalha sem ver números — mesmo padrão do podeVerValores das Encomendas.
 */
export async function podeVerValoresProdutos(userId: string): Promise<boolean> {
  const [admin, telasDeValor] = await Promise.all([
    temAcesso(userId, ['produtos'], { nivel: 'admin' }),
    temAcesso(userId, ['precos', 'painel'], { nivel: 'leitura' }),
  ])
  return admin || telasDeValor
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
