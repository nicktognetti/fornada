import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { validarAssinatura } from './assinatura'

const SECRET = 'segredo-de-teste'
const CORPO = '{"entry":[{"changes":[{"value":{"messages":[]}}]}]}'
const assinar = (corpo: string, secret: string) =>
  'sha256=' + createHmac('sha256', secret).update(corpo, 'utf8').digest('hex')

describe('validarAssinatura (X-Hub-Signature-256 da Meta)', () => {
  it('assinatura correta → ok', () => {
    expect(validarAssinatura(CORPO, assinar(CORPO, SECRET), SECRET)).toBe('ok')
  })

  it('corpo adulterado → invalida', () => {
    expect(validarAssinatura(CORPO + 'x', assinar(CORPO, SECRET), SECRET)).toBe('invalida')
  })

  it('secret errado → invalida', () => {
    expect(validarAssinatura(CORPO, assinar(CORPO, 'outro'), SECRET)).toBe('invalida')
  })

  it('header ausente ou sem prefixo → invalida', () => {
    expect(validarAssinatura(CORPO, null, SECRET)).toBe('invalida')
    expect(validarAssinatura(CORPO, 'md5=abc', SECRET)).toBe('invalida')
  })

  it('sem META_APP_SECRET configurado → sem-secret (aceita com aviso)', () => {
    expect(validarAssinatura(CORPO, null, undefined)).toBe('sem-secret')
    expect(validarAssinatura(CORPO, null, '  ')).toBe('sem-secret')
  })
})
