// Agrupamento do plano de produção: itens de várias encomendas somados por
// setor. Função PURA (sem banco) para poder ser testada — é o cálculo que a
// cozinha usa para saber quanto fazer, então errar aqui é produzir errado.

import { normalizeSearch } from './format'

export type LinhaItem = {
  encomenda_id: string
  produto_id: string | null
  descricao: string
  quantidade: number
  observacao: string | null
  local: string | null
}

export type ItemProducao = {
  descricao: string
  quantidade: number
  /** kg/L/un — vem da ficha do produto; null em item avulso digitado à mão. */
  unidade: string | null
  /** Em quantas encomendas diferentes este item aparece. */
  pedidos: number
  /** Observações dos itens ("sem lactose"), sem repetição. */
  observacoes: string[]
}

export type GrupoProducao = {
  /** Setor de produção (Confeitaria, Padaria…). null = sem setor definido. */
  local: string | null
  itens: ItemProducao[]
}

/**
 * Soma os itens por setor.
 *
 * - Mesmo produto do catálogo soma pelo `produto_id`.
 * - Item avulso soma pelo nome normalizado: "Bolo de Cenoura" e
 *   "bolo de cenoura" viram uma linha só (foram digitados à mão em pedidos
 *   diferentes, mas é o mesmo bolo para quem vai fazer).
 * - Setores em ordem alfabética; "sem setor" por último.
 * - Dentro do setor, maior quantidade primeiro (o que ocupa mais a bancada).
 */
export function agruparParaProducao(
  linhas: LinhaItem[],
  unidadePorProduto: Map<string, string | null>,
): GrupoProducao[] {
  type Acc = ItemProducao & { encomendas: Set<string> }
  const porLocal = new Map<string, Map<string, Acc>>()

  for (const l of linhas) {
    const chaveLocal = l.local?.trim() || ''
    if (!porLocal.has(chaveLocal)) porLocal.set(chaveLocal, new Map())
    const grupo = porLocal.get(chaveLocal)!

    const chaveItem = l.produto_id ?? `avulso:${normalizeSearch(l.descricao)}`
    const qtd = Number(l.quantidade) || 0
    const obs = l.observacao?.trim()
    const existente = grupo.get(chaveItem)

    if (existente) {
      existente.quantidade += qtd
      existente.encomendas.add(l.encomenda_id)
      if (obs && !existente.observacoes.includes(obs)) existente.observacoes.push(obs)
    } else {
      grupo.set(chaveItem, {
        descricao: l.descricao.trim(),
        quantidade: qtd,
        unidade: l.produto_id ? unidadePorProduto.get(l.produto_id) ?? null : null,
        pedidos: 0,
        observacoes: obs ? [obs] : [],
        encomendas: new Set([l.encomenda_id]),
      })
    }
  }

  return [...porLocal.entries()]
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'pt-BR')))
    .map(([local, mapa]) => ({
      local: local || null,
      itens: [...mapa.values()]
        .map(({ encomendas, ...item }) => ({ ...item, pedidos: encomendas.size }))
        .sort((a, b) => b.quantidade - a.quantidade || a.descricao.localeCompare(b.descricao, 'pt-BR')),
    }))
}
