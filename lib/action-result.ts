/**
 * Retorno padrão das Server Actions.
 *
 * `ActionResult` (sem tipo)      → { error?, success? }
 * `ActionResult<{ id: string }>` → { error?, data? }
 *
 * Estava copiado em 11 arquivos (7 na forma genérica, 4 na simples); qualquer
 * ajuste no contrato precisava ser feito em todos.
 */
export type ActionResult<T = void> = T extends void
  ? { error?: string; success?: boolean }
  : { error?: string; data?: T }
