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

  it('conta a validade a partir do dia de Brasília, não do UTC', () => {
    // Criado 01/07 às 22h (BRT) = 02/07 01:00 UTC. Pelo UTC a contagem
    // começaria em 02/07 e o orçamento venceria um dia depois do devido.
    const criadoTarde = '2026-07-02T01:00:00Z'
    expect(orcamentoExpirado(criadoTarde, 7, '2026-07-08')).toBe(false) // dia da validade
    expect(orcamentoExpirado(criadoTarde, 7, '2026-07-09')).toBe(true)  // já venceu
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
