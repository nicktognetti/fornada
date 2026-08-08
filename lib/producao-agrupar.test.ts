import { describe, it, expect } from 'vitest'
import { agruparParaProducao, type LinhaItem } from './producao-agrupar'

const UN = new Map<string, string | null>([
  ['p-bolo', 'kg'],
  ['p-torta', 'un'],
  ['p-suco', 'L'],
])

function linha(over: Partial<LinhaItem> = {}): LinhaItem {
  return {
    encomenda_id: 'e1', produto_id: null, descricao: 'Item',
    quantidade: 1, observacao: null, local: null, ...over,
  }
}

describe('agruparParaProducao', () => {
  it('soma o mesmo produto vindo de encomendas diferentes', () => {
    const g = agruparParaProducao([
      linha({ encomenda_id: 'e1', produto_id: 'p-bolo', descricao: 'Bolo', quantidade: 2, local: 'Confeitaria' }),
      linha({ encomenda_id: 'e2', produto_id: 'p-bolo', descricao: 'Bolo', quantidade: 1.5, local: 'Confeitaria' }),
    ], UN)

    expect(g).toHaveLength(1)
    expect(g[0].local).toBe('Confeitaria')
    expect(g[0].itens[0]).toMatchObject({ descricao: 'Bolo', quantidade: 3.5, unidade: 'kg', pedidos: 2 })
  })

  it('separa por setor', () => {
    const g = agruparParaProducao([
      linha({ produto_id: 'p-bolo', descricao: 'Bolo', quantidade: 1, local: 'Confeitaria' }),
      linha({ produto_id: 'p-torta', descricao: 'Pão', quantidade: 10, local: 'Padaria' }),
    ], UN)

    expect(g.map((x) => x.local)).toEqual(['Confeitaria', 'Padaria'])
  })

  it('"sem setor" vai para o fim da lista', () => {
    const g = agruparParaProducao([
      linha({ descricao: 'Avulso', local: null }),
      linha({ descricao: 'Pão', local: 'Padaria' }),
      linha({ descricao: 'Bolo', local: 'Confeitaria' }),
    ], UN)

    expect(g.map((x) => x.local)).toEqual(['Confeitaria', 'Padaria', null])
  })

  it('item avulso soma ignorando caixa e acento', () => {
    const g = agruparParaProducao([
      linha({ encomenda_id: 'e1', descricao: 'Bolo de Cenoura', quantidade: 1 }),
      linha({ encomenda_id: 'e2', descricao: 'bolo de cenoura', quantidade: 2 }),
    ], UN)

    expect(g[0].itens).toHaveLength(1)
    expect(g[0].itens[0].quantidade).toBe(3)
    expect(g[0].itens[0].pedidos).toBe(2)
  })

  it('produtos diferentes com o mesmo nome NÃO se misturam', () => {
    const g = agruparParaProducao([
      linha({ produto_id: 'p-bolo', descricao: 'Bolo', quantidade: 1, local: 'A' }),
      linha({ produto_id: 'p-torta', descricao: 'Bolo', quantidade: 5, local: 'A' }),
    ], UN)

    expect(g[0].itens).toHaveLength(2)
  })

  it('mesma encomenda com o item repetido conta 1 pedido só', () => {
    const g = agruparParaProducao([
      linha({ encomenda_id: 'e1', produto_id: 'p-bolo', descricao: 'Bolo', quantidade: 1 }),
      linha({ encomenda_id: 'e1', produto_id: 'p-bolo', descricao: 'Bolo', quantidade: 2 }),
    ], UN)

    expect(g[0].itens[0].quantidade).toBe(3)
    expect(g[0].itens[0].pedidos).toBe(1)
  })

  it('junta observações sem repetir', () => {
    const g = agruparParaProducao([
      linha({ encomenda_id: 'e1', produto_id: 'p-bolo', descricao: 'Bolo', observacao: 'sem lactose' }),
      linha({ encomenda_id: 'e2', produto_id: 'p-bolo', descricao: 'Bolo', observacao: 'sem lactose' }),
      linha({ encomenda_id: 'e3', produto_id: 'p-bolo', descricao: 'Bolo', observacao: 'com morango' }),
    ], UN)

    expect(g[0].itens[0].observacoes).toEqual(['sem lactose', 'com morango'])
  })

  it('ordena por quantidade decrescente dentro do setor', () => {
    const g = agruparParaProducao([
      linha({ produto_id: 'p-bolo', descricao: 'Pouco', quantidade: 1, local: 'A' }),
      linha({ produto_id: 'p-torta', descricao: 'Muito', quantidade: 50, local: 'A' }),
      linha({ produto_id: 'p-suco', descricao: 'Medio', quantidade: 10, local: 'A' }),
    ], UN)

    expect(g[0].itens.map((i) => i.descricao)).toEqual(['Muito', 'Medio', 'Pouco'])
  })

  it('item avulso não recebe unidade (não tem ficha)', () => {
    const g = agruparParaProducao([linha({ descricao: 'Encomenda especial', quantidade: 1 })], UN)
    expect(g[0].itens[0].unidade).toBeNull()
  })

  it('quantidade inválida vira zero em vez de NaN', () => {
    const g = agruparParaProducao([
      linha({ produto_id: 'p-bolo', descricao: 'Bolo', quantidade: NaN as unknown as number }),
    ], UN)
    expect(g[0].itens[0].quantidade).toBe(0)
  })

  it('lista vazia devolve nenhum grupo', () => {
    expect(agruparParaProducao([], UN)).toEqual([])
  })
})
