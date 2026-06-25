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

export interface NovaCompraInput {
  unidade_id: string
  fornecedor: string
  data_compra: string
  valor_total: number
  observacao?: string
}

export type ActionResult = { error?: string; success?: boolean }
