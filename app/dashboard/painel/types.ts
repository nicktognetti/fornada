export type ProdutoRentabilidade = {
  id: string
  nome: string
  custo: number
  preco: number
  margem: number   // (preco - custo) / preco * 100
  markup: number   // (preco - custo) / custo * 100
  status: 'lucrativo' | 'baixo' | 'prejuizo'
}

export type SimulacaoResultado = {
  produto: string
  precoAtual: number
  novoPreco: number
  margemAtual: number
  novaMargem: number
  variacao: number  // novaMargem - margemAtual em pontos percentuais
}

export type PainelResumo = {
  margemMedia: number
  markupMedio: number
  maisLucrativo: { nome: string; margem: number } | null
  menosLucrativo: { nome: string; margem: number } | null
  precoMedio: number
  totalProdutos: number
}
