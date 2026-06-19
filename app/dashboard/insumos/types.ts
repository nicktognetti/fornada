export interface Insumo {
  id: string
  empresa_id: string
  unidade_id: string
  nome: string
  categoria: string | null
  unidade_uso: string
  ativo: boolean
}

export interface CustoAtual {
  insumo_id: string
  custo_uso: number | null
  preco_compra: number | null
  unidade_compra: string | null
  qtd_uso_por_compra: number | null
  vigente_desde: string | null
}

export interface InsumoComCusto extends Insumo {
  custo: CustoAtual | null
  fichasCount: number
}

export interface InsumoPreco {
  id: string
  insumo_id: string
  fornecedor_id: string | null
  unidade_id: string | null
  unidade_compra: string
  preco_compra: number
  qtd_uso_por_compra: number
  vigente_desde: string
  nota_fiscal_ref: string | null
  criado_em: string
}

export type ActionResult = { error?: string; success?: boolean }
