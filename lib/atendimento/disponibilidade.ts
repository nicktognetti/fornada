// Regra de disponibilidade de produto por canal (PURA, testável).
// Usada pelo catálogo do agente; separada para não puxar o supabaseAdmin
// (que exige env) nos testes.

import type { CanalAtendimento } from './canal-tipos'

export type Disponibilidade =
  | 'sempre_tem'
  | 'tem_hoje'
  | 'acabou_hoje'
  | 'confirmar_com_equipe'
  | 'nao_vendido_neste_canal'

export type FlagsProduto = {
  sempre_disponivel: boolean | null
  disponivel_hoje: boolean | null
  vende_delivery: boolean | null
  vende_encomenda: boolean | null
}

/** Segura por padrão: na dúvida, "confirmar com a equipe". */
export function calcularDisponibilidade(
  flags: FlagsProduto | undefined,
  canal: CanalAtendimento,
): Disponibilidade {
  if (!flags) return 'confirmar_com_equipe'
  const vendeNoCanal = canal === 'delivery' ? flags.vende_delivery !== false : flags.vende_encomenda === true
  if (!vendeNoCanal) return 'nao_vendido_neste_canal'
  if (flags.sempre_disponivel === true) return 'sempre_tem'
  if (flags.disponivel_hoje === true) return 'tem_hoje'
  if (flags.disponivel_hoje === false) return 'acabou_hoje'
  return 'confirmar_com_equipe'
}
