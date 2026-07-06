// Texto do aviso de pedido novo para a equipe (PURO, testável).

import type { CanalAtendimento } from './canal-tipos'
import type { DadosDaEncomenda } from './marcadores'

export function formatarAvisoPedido(
  canal: CanalAtendimento,
  dados: DadosDaEncomenda,
  unidadeNome: string,
  numeroCliente: string,
): string {
  const titulo = canal === 'delivery' ? '🛵 PEDIDO DE DELIVERY' : '📝 NOVA ENCOMENDA'
  const linhas = [
    `${titulo} — ${unidadeNome}`,
    '',
    `Produto: ${dados.produto}`,
    dados.quantidade && dados.quantidade !== '?' ? `Quantidade: ${dados.quantidade}` : null,
    canal === 'delivery'
      ? (dados.endereco ? `Entregar em: ${dados.endereco}` : 'Endereço: (não informado)')
      : `Retirada: ${dados.data}`,
    dados.nome && dados.nome !== '?' ? `Cliente: ${dados.nome}` : null,
    `WhatsApp: ${numeroCliente}`,
    '',
    'Detalhes no Fornada → Atendimento.',
  ]
  return linhas.filter((l) => l !== null).join('\n')
}
