import { describe, it, expect } from 'vitest'
import { formatDuracao } from './duracao'

describe('formatDuracao', () => {
  it('menos de 1 minuto', () => {
    expect(formatDuracao(0)).toBe('menos de 1min')
    expect(formatDuracao(30_000)).toBe('menos de 1min')
  })
  it('minutos', () => {
    expect(formatDuracao(60_000)).toBe('1min')
    expect(formatDuracao(45 * 60_000)).toBe('45min')
  })
  it('horas e minutos', () => {
    expect(formatDuracao(90 * 60_000)).toBe('1h 30min')
    expect(formatDuracao(2 * 3_600_000)).toBe('2h')
  })
  it('dias e horas', () => {
    expect(formatDuracao(86_400_000 + 3 * 3_600_000)).toBe('1d 3h')
    expect(formatDuracao(2 * 86_400_000)).toBe('2d')
  })
  it('valores inválidos', () => {
    expect(formatDuracao(-5)).toBe('—')
    expect(formatDuracao(Infinity)).toBe('—')
  })
})
