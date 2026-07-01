// Status de exibição do orçamento: os 3 persistidos + "expirado" derivado da validade.
export type OrcamentoStatusBase = 'aguardando' | 'aprovado' | 'recusado'
export type OrcamentoStatusDisplay = OrcamentoStatusBase | 'expirado'

/**
 * `true` se um orçamento passou da validade (comparação por dia, sem hora).
 * Validade = `created_at` + `validade_dias`. Só faz sentido para os que
 * seguem "aguardando"; aprovados/recusados já estão resolvidos.
 */
export function orcamentoExpirado(createdAtISO: string, validadeDias: number, hojeISO?: string): boolean {
  if (!validadeDias || validadeDias <= 0) return false
  const criado = new Date(createdAtISO)
  if (isNaN(criado.getTime())) return false

  // Dia de expiração (início do dia), em UTC para bater com a fatia YYYY-MM-DD.
  const expira = new Date(Date.UTC(criado.getUTCFullYear(), criado.getUTCMonth(), criado.getUTCDate() + validadeDias))
  const expiraDia = expira.toISOString().slice(0, 10)

  const hoje = hojeISO ?? new Date().toISOString().slice(0, 10)
  return hoje > expiraDia
}

/** Status para exibição: converte "aguardando" vencido em "expirado". */
export function statusExibicao(
  status: OrcamentoStatusBase,
  createdAtISO: string,
  validadeDias: number,
  hojeISO?: string,
): OrcamentoStatusDisplay {
  if (status === 'aguardando' && orcamentoExpirado(createdAtISO, validadeDias, hojeISO)) return 'expirado'
  return status
}
