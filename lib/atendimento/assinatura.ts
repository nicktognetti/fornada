// Validação da assinatura do webhook (X-Hub-Signature-256).
// A Meta assina cada POST com HMAC-SHA256 do corpo usando o App Secret —
// sem isso, qualquer um que descubra a URL consegue imitar a Meta.

import { createHmac, timingSafeEqual } from 'node:crypto'

export type ResultadoAssinatura = 'ok' | 'invalida' | 'sem-secret'

/**
 * Confere a assinatura do corpo cru do webhook.
 * - `sem-secret`: env META_APP_SECRET não configurado — o chamador decide
 *   (hoje: aceita com aviso no log, para não derrubar o robô antes de o
 *   secret ser cadastrado).
 * - `invalida`: header ausente/errado → rejeitar com 401.
 */
export function validarAssinatura(
  corpoCru: string,
  headerAssinatura: string | null,
  appSecret: string | undefined,
): ResultadoAssinatura {
  if (!appSecret?.trim()) return 'sem-secret'
  if (!headerAssinatura?.startsWith('sha256=')) return 'invalida'

  const esperada = createHmac('sha256', appSecret.trim()).update(corpoCru, 'utf8').digest('hex')
  const recebida = headerAssinatura.slice('sha256='.length)

  if (recebida.length !== esperada.length) return 'invalida'
  try {
    return timingSafeEqual(Buffer.from(recebida, 'hex'), Buffer.from(esperada, 'hex'))
      ? 'ok'
      : 'invalida'
  } catch {
    return 'invalida'
  }
}
