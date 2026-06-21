export type { ProdutoFinanceiro, PainelIndicadores, FichaFinanceira } from '@/app/actions/painel'

export type ProdutoRentabilidade = {
  id: string
  nome: string
  custo: number
  preco: number
  margem: number
  markup: number
  status: 'lucrativo' | 'baixo' | 'prejuizo'
}

export type SimulacaoResultado = {
  produto: string
  precoAtual: number
  novoPreco: number
  margemAtual: number
  novaMargem: number
  variacao: number
}

export type PainelResumo = {
  margemMedia: number
  markupMedio: number
  maisLucrativo: { nome: string; margem: number } | null
  menosLucrativo: { nome: string; margem: number } | null
  precoMedio: number
  totalProdutos: number
}
