import { describe, it, expect } from 'vitest'
import { round2, precoComAjuste, subtotalItem, totalPedido } from './pedido-calc'

describe('round2', () => {
  it('arredonda para 2 casas', () => {
    expect(round2(1.005)).toBe(1.01)
    expect(round2(0.1 + 0.2)).toBe(0.3) // 0.30000000000000004
    expect(round2(2.905)).toBe(2.91)
  })
  it('mantém inteiros e negativos', () => {
    expect(round2(10)).toBe(10)
    expect(round2(-1.236)).toBe(-1.24)
  })
})

describe('precoComAjuste', () => {
  it('aplica acréscimo percentual sobre a base', () => {
    expect(precoComAjuste(28, 10)).toBe(30.8)   // Bolo de Cenoura +10%
    expect(precoComAjuste(5.9, 0)).toBe(5.9)
  })
  it('aplica desconto percentual', () => {
    expect(precoComAjuste(20, -25)).toBe(15)
  })
  it('devolve a base quando base<=0 ou pct inválido', () => {
    expect(precoComAjuste(0, 10)).toBe(0)
    expect(precoComAjuste(28, NaN)).toBe(28)
  })
})

describe('subtotalItem', () => {
  it('multiplica quantidade por preço', () => {
    expect(subtotalItem(2, 30.8)).toBe(61.6)
    expect(subtotalItem(5, 5.9)).toBe(29.5)
    expect(subtotalItem(3, 12.99)).toBe(38.97)
  })
  it('zera com quantidade inválida ou preço negativo', () => {
    expect(subtotalItem(0, 10)).toBe(0)
    expect(subtotalItem(-1, 10)).toBe(0)
    expect(subtotalItem(2, -5)).toBe(0)
  })
})

describe('totalPedido', () => {
  it('soma os subtotais dos itens', () => {
    // Cenário validado no preview: 2×30,80 + 5×5,90 = 91,10
    expect(totalPedido([
      { quantidade: 2, precoUnitario: 30.8 },
      { quantidade: 5, precoUnitario: 5.9 },
    ])).toBe(91.1)
  })
  it('ignora itens inválidos e devolve 0 para lista vazia', () => {
    expect(totalPedido([])).toBe(0)
    expect(totalPedido([
      { quantidade: 0, precoUnitario: 10 },
      { quantidade: 3, precoUnitario: 4 },
    ])).toBe(12)
  })
})
