import { describe, it, expect } from 'vitest'
import { parseDecimalBR, formatBRL, formatCustoUso, unidadeGrande, fatorGrande, valorPorGrande, formatCustoGrande } from './format'

describe('parseDecimalBR', () => {
  describe('casos exigidos', () => {
    it('"1.234,56" → 1234.56 (ponto = milhar, vírgula = decimal)', () => {
      expect(parseDecimalBR('1.234,56')).toBe(1234.56)
    })

    it('"10,5" → 10.5', () => {
      expect(parseDecimalBR('10,5')).toBe(10.5)
    })

    it('"1000" → 1000', () => {
      expect(parseDecimalBR('1000')).toBe(1000)
    })

    it('"R$ 1.234,56" → 1234.56 (ignora prefixo e espaços)', () => {
      expect(parseDecimalBR('R$ 1.234,56')).toBe(1234.56)
    })

    it('string vazia → NaN (inválido)', () => {
      expect(Number.isNaN(parseDecimalBR(''))).toBe(true)
    })

    it('valores inválidos → NaN', () => {
      expect(Number.isNaN(parseDecimalBR('abc'))).toBe(true)
      expect(Number.isNaN(parseDecimalBR('R$'))).toBe(true)
      expect(Number.isNaN(parseDecimalBR(','))).toBe(true)
      expect(Number.isNaN(parseDecimalBR('.'))).toBe(true)
      expect(Number.isNaN(parseDecimalBR('-'))).toBe(true)
      expect(Number.isNaN(parseDecimalBR('1.2.3'))).toBe(true)
    })

    it('nulo / indefinido → NaN', () => {
      expect(Number.isNaN(parseDecimalBR(null))).toBe(true)
      expect(Number.isNaN(parseDecimalBR(undefined))).toBe(true)
    })

    it('negativos são preservados', () => {
      expect(parseDecimalBR('-10,5')).toBe(-10.5)
      expect(parseDecimalBR('-1.234,56')).toBe(-1234.56)
      expect(parseDecimalBR('-1000')).toBe(-1000)
    })
  })

  describe('regressão do bug: ponto como decimal quando não é milhar', () => {
    it('"10.5" → 10.5 (antes virava 105)', () => {
      expect(parseDecimalBR('10.5')).toBe(10.5)
    })

    it('"10.00" → 10 (antes virava 1000)', () => {
      expect(parseDecimalBR('10.00')).toBe(10)
    })

    it('"0.50" → 0.5 (antes virava 50)', () => {
      expect(parseDecimalBR('0.50')).toBe(0.5)
    })

    it('"2.5" → 2.5 (antes virava 25)', () => {
      expect(parseDecimalBR('2.5')).toBe(2.5)
    })
  })

  describe('milhar com ponto', () => {
    it('"1.000" → 1000', () => {
      expect(parseDecimalBR('1.000')).toBe(1000)
    })

    it('"1.234" → 1234 (convenção BR: grupo de 3 = milhar)', () => {
      expect(parseDecimalBR('1.234')).toBe(1234)
    })

    it('"1.234.567" → 1234567', () => {
      expect(parseDecimalBR('1.234.567')).toBe(1234567)
    })

    it('"1.000.000,00" → 1000000', () => {
      expect(parseDecimalBR('1.000.000,00')).toBe(1000000)
    })
  })

  describe('outros formatos', () => {
    it('"1,5" → 1.5', () => {
      expect(parseDecimalBR('1,5')).toBe(1.5)
    })

    it('"  42  " → 42 (espaços)', () => {
      expect(parseDecimalBR('  42  ')).toBe(42)
    })

    it('"0" → 0', () => {
      expect(parseDecimalBR('0')).toBe(0)
    })

    it('"0,00" → 0', () => {
      expect(parseDecimalBR('0,00')).toBe(0)
    })
  })
})

describe('formatBRL', () => {
  it('formata com 2 casas e separadores BR', () => {
    expect(formatBRL(1234.56)).toBe('1.234,56')
    expect(formatBRL(10.5)).toBe('10,50')
    expect(formatBRL(0)).toBe('0,00')
  })

  it('é seguro com valores inválidos (NaN/Infinity → "0,00")', () => {
    expect(formatBRL(NaN)).toBe('0,00')
    expect(formatBRL(Infinity)).toBe('0,00')
  })

  it('round-trip: parse → format', () => {
    expect(formatBRL(parseDecimalBR('1.234,56'))).toBe('1.234,56')
  })
})

describe('formatCustoUso', () => {
  it('usa 4 casas para valores pequenos', () => {
    expect(formatCustoUso(0.042, 'g')).toBe('R$ 0,0420/g')
  })

  it('usa 2 casas para valores >= 0,1', () => {
    expect(formatCustoUso(2.5, 'un')).toBe('R$ 2,50/un')
  })

  it('é seguro com NaN', () => {
    expect(formatCustoUso(NaN, 'g')).toBe('R$ 0,00/g')
  })
})

describe('unidade grande (por kg/L)', () => {
  it('unidadeGrande: g→kg, ml→L, un→un', () => {
    expect(unidadeGrande('g')).toBe('kg')
    expect(unidadeGrande('kg')).toBe('kg')
    expect(unidadeGrande('ml')).toBe('L')
    expect(unidadeGrande('l')).toBe('L')
    expect(unidadeGrande('un')).toBe('un')
    expect(unidadeGrande(null)).toBe('un')
  })

  it('fatorGrande: 1000 para g/ml, 1 para o resto', () => {
    expect(fatorGrande('g')).toBe(1000)
    expect(fatorGrande('ml')).toBe(1000)
    expect(fatorGrande('kg')).toBe(1)
    expect(fatorGrande('un')).toBe(1)
  })

  it('valorPorGrande: converte custo/grama em custo/kg', () => {
    expect(valorPorGrande(0.0125, 'g')).toBeCloseTo(12.5, 5)
    expect(valorPorGrande(2.5, 'un')).toBe(2.5)
  })

  it('formatCustoGrande: custo por grama vira R$/kg legível', () => {
    expect(formatCustoGrande(0.0125, 'g')).toBe('R$ 12,50/kg')
    expect(formatCustoGrande(0.0036, 'g')).toBe('R$ 3,60/kg')
    expect(formatCustoGrande(2.5, 'un')).toBe('R$ 2,50/un')
  })

  it('formatCustoGrande é seguro com NaN', () => {
    expect(formatCustoGrande(NaN, 'g')).toBe('R$ 0,00/kg')
  })
})
