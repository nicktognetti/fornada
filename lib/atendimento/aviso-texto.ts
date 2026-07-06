// Texto do aviso de pedido novo para a equipe (PURO, testável).

import type { CanalAtendimento } from './canal-tipos'
import type { DadosDaEncomenda } from './marcadores'

/**
 * Versão em LINHA ÚNICA do aviso — parâmetro de template da Meta não
 * aceita quebra de linha nem tab. Usada quando o canal tem
 * `avisar_template` configurado.
 */
export function formatarAvisoPedidoLinha(
  canal: CanalAtendimento,
  dados: DadosDaEncomenda,
  unidadeNome: string,
  numeroCliente: string,
): string {
  const titulo = canal === 'delivery' ? 'PEDIDO DE DELIVERY' : 'NOVA ENCOMENDA'
  const partes = [
    `${titulo} — ${unidadeNome}`,
    dados.produto,
    dados.quantidade && dados.quantidade !== '?' ? `qtd: ${dados.quantidade}` : null,
    canal === 'delivery'
      ? `entregar em: ${dados.endereco ?? '(endereço não informado)'}`
      : `retirada: ${dados.data}`,
    dados.nome && dados.nome !== '?' ? `cliente: ${dados.nome}` : null,
    `whatsapp: ${numeroCliente}`,
  ]
  return partes.filter((p) => p !== null).join(' · ').replace(/[\n\t]+/g, ' ')
}

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
