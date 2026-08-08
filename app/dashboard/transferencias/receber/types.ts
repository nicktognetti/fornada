export type StatusFinanceiro = 'pendente' | 'a_receber' | 'recebido' | 'cancelado'

export interface TransferenciaReceber {
  id: string
  codigo: string
  tipo: 'TRANSFERENCIA' | 'DEVOLUCAO'
  status: string
  status_financeiro: StatusFinanceiro
  valor_total: number
  unidade_origem_id: string
  unidade_origem_nome: string
  unidade_destino_id: string
  total_itens: number
  produtos: string[]
  created_at: string
}

export interface Compra {
  id: string
  unidade_id: string
  fornecedor: string
  data_compra: string
  valor_total: number
  observacao: string | null
  xml_url: string | null
  created_at: string
}

/** Item de uma compra. `insumo_id` liga ao cadastro; null = item avulso. */
export interface NovaCompraItemInput {
  insumo_id: string | null
  descricao: string
  quantidade: number
  preco_unitario: number
  /** Se true e há insumo ligado, grava um novo preço vigente para o insumo. */
  atualizar_custo: boolean
}

export interface NovaCompraInput {
  unidade_id: string
  fornecedor: string
  data_compra: string
  valor_total: number
  observacao?: string
  itens?: NovaCompraItemInput[]
}

/** Insumo com o custo vigente, para montar o item da compra. */
export interface InsumoParaCompra {
  id: string
  nome: string
  unidade_uso: string
  /** Preço da última compra cadastrada (o que será reajustado). */
  preco_atual: number | null
  /** Quanto de uso rende uma unidade de compra (ex.: 5000 g por saco). */
  qtd_uso_por_compra: number | null
  /** Descrição da embalagem ("Saco 5 kg"). */
  unidade_compra: string | null
}

export type ActionResult = { error?: string; success?: boolean; aviso?: string }
