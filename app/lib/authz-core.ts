// Núcleo PURO da autorização — sem imports de servidor (Supabase, next/headers).
// Isolado aqui para ser testável sem banco. `authz.ts` busca os dados e delega
// a decisão para `avaliaAcesso`.

export type Nivel = 'leitura' | 'escrita' | 'admin'

export const RANK: Record<string, number> = { leitura: 1, escrita: 2, admin: 3 }

export interface PermissaoLike {
  tela: string
  acesso: string
  unidade_id: string | null
}

/** Há permissão de admin global (tela '*', acesso 'admin', escopo global)? */
export function isAdminGlobal(lista: PermissaoLike[]): boolean {
  return lista.some(
    (p) => p.tela === '*' && p.acesso === 'admin' && p.unidade_id === null,
  )
}

/**
 * Decide se a lista de permissões concede acesso a PELO MENOS UMA das `telas`
 * no nível mínimo `nivel` (padrão 'escrita').
 *
 * - Admin global sobrepõe tudo.
 * - Se `unidadeId` é informado, a permissão precisa ser global (unidade_id null)
 *   ou da mesma unidade. Se `unidadeId` é null/undefined, qualquer escopo serve.
 */
export function avaliaAcesso(
  lista: PermissaoLike[],
  telas: string[],
  opts?: { unidadeId?: string | null; nivel?: Nivel },
): boolean {
  const nivel = opts?.nivel ?? 'escrita'

  if (isAdminGlobal(lista)) return true

  return lista.some(
    (p) =>
      telas.includes(p.tela) &&
      (RANK[p.acesso] ?? 0) >= RANK[nivel] &&
      (p.unidade_id === null || opts?.unidadeId == null || p.unidade_id === opts.unidadeId),
  )
}
