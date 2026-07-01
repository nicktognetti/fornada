import { describe, it, expect } from 'vitest'
import { orcamentoExpirado, statusExibicao } from './orcamento-status'

describe('orcamentoExpirado', () => {
  it('não expira antes de vencer', () => {
    // criado 2026-07-01, validade 7 dias → expira dia 2026-07-08
    expect(orcamentoExpirado('2026-07-01T10:00:00Z', 7, '2026-07-05')).toBe(false)
    expect(orcamentoExpirado('2026-07-01T10:00:00Z', 7, '2026-07-08')).toBe(false) // no dia ainda vale
  })
  it('expira depois do dia de validade', () => {
    expect(orcamentoExpirado('2026-07-01T10:00:00Z', 7, '2026-07-09')).toBe(true)
    expect(orcamentoExpirado('2026-07-01T10:00:00Z', 7, '2026-08-01')).toBe(true)
  })
  it('validade zero ou inválida nunca expira', () => {
    expect(orcamentoExpirado('2026-07-01T10:00:00Z', 0, '2026-12-01')).toBe(false)
    expect(orcamentoExpirado('data-ruim', 7, '2026-12-01')).toBe(false)
  })
})

describe('statusExibicao', () => {
  it('converte aguardando vencido em expirado', () => {
    expect(statusExibicao('aguardando', '2026-07-01T10:00:00Z', 7, '2026-07-20')).toBe('expirado')
  })
  it('aguardando dentro da validade permanece', () => {
    expect(statusExibicao('aguardando', '2026-07-01T10:00:00Z', 7, '2026-07-03')).toBe('aguardando')
  })
  it('aprovado/recusado nunca viram expirado', () => {
    expect(statusExibicao('aprovado', '2026-07-01T10:00:00Z', 7, '2026-12-01')).toBe('aprovado')
    expect(statusExibicao('recusado', '2026-07-01T10:00:00Z', 7, '2026-12-01')).toBe('recusado')
  })
})
