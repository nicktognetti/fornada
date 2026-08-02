// Status de exibição do orçamento: os 3 persistidos + "expirado" derivado da validade.
import { diaBR, hojeBR } from './format'

export type OrcamentoStatusBase = 'aguardando' | 'aprovado' | 'recusado'
export type OrcamentoStatusDisplay = OrcamentoStatusBase | 'expirado'

/**
 * `true` se um orçamento passou da validade (comparação por dia, sem hora).
 * Validade = `created_at` + `validade_dias`. Só faz sentido para os que
 * seguem "aguardando"; aprovados/recusados já estão resolvidos.
 *
 * Os dias são apurados no fuso da padaria: em UTC, um orçamento criado às
 * 22h contava a validade a partir do dia seguinte, e o vencimento antecipava
 * para as 21h do dia anterior.
 */
export function orcamentoExpirado(createdAtISO: string, validadeDias: number, hojeISO?: string): boolean {
  if (!validadeDias || validadeDias <= 0) return false

  const criadoDia = diaBR(createdAtISO)
  if (!criadoDia) return false

  // Aritmética de calendário sobre o dia local (Date.UTC aqui é só para somar
  // dias sem envolver fuso — entra e sai como YYYY-MM-DD).
  const [ano, mes, dia] = criadoDia.split('-').map(Number)
  const expira = new Date(Date.UTC(ano, mes - 1, dia + validadeDias))
  const expiraDia = expira.toISOString().slice(0, 10)

  const hoje = hojeISO ?? hojeBR()
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
