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

/**
 * Setor (categoria) e unidade REAIS de uma receita, via service role.
 * Mesmo motivo do `unidadeDoRegistro`: precisamos do dado real mesmo sob RLS
 * para então decidir permissão. Retorna `null` se a receita não existe.
 */
export async function receitaSetorUnidade(
  receitaId: string,
): Promise<{ unidade_id: string | null; categoria: string | null } | null> {
  const { data } = await supabaseAdmin
    .from('receita')
    .select('unidade_id, categoria')
    .eq('id', receitaId)
    .maybeSingle()
  return (data as { unidade_id: string | null; categoria: string | null } | null) ?? null
}

/**
 * Setores (locais) que o usuário pode ver/editar no Caderno de uma unidade.
 *
 * Retorna `null` = SEM restrição (vê todos os setores):
 *  - admin global;
 *  - quem tem a tela de Fichas Técnicas (`receitas`) aplicável — é gestão;
 *  - permissão de Caderno sem lista de setores (`locais` null/vazio).
 * Caso contrário, a união dos setores marcados nas permissões de Caderno aplicáveis.
 *
 * "Aplicável" = permissão global (unidade_id null) ou da mesma unidade.
 * Usar SOMENTE em Server Actions/Server Components.
 */
export async function setoresPermitidosCaderno(
  userId: string,
  unidadeId: string | null,
): Promise<string[] | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('permissao')
    .select('tela, acesso, unidade_id, locais')
    .eq('usuario_id', userId)
  const lista = (data ?? []) as {
    tela: string; acesso: string; unidade_id: string | null; locais: string[] | null
  }[]

  if (lista.some((p) => p.tela === '*' && p.acesso === 'admin' && p.unidade_id === null)) return null

  const aplica = (p: { unidade_id: string | null }) =>
    p.unidade_id === null || unidadeId == null || p.unidade_id === unidadeId

  // Gestão (Fichas Técnicas) na unidade → vê todos os setores
  if (lista.some((p) => p.tela === 'receitas' && aplica(p))) return null

  const cadernoRows = lista.filter((p) => p.tela === 'caderno' && aplica(p))
  if (cadernoRows.length === 0) return null
  // Qualquer permissão de Caderno sem setores marcados = todos
  if (cadernoRows.some((p) => !p.locais || p.locais.length === 0)) return null
  return [...new Set(cadernoRows.flatMap((p) => p.locais as string[]))]
}
