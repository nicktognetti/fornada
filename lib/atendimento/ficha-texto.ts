// Ficha do cliente que vai no prompt do agente (PURA, testável).
// Com ela o robô cumprimenta pelo nome, sabe o endereço salvo e os
// últimos pedidos — sem redigitar nada na volta do cliente.

export type FichaCliente = {
  nome: string | null
  endereco: string | null
  observacao: string | null
  ultimosPedidos: { produto: string; quando: string }[]
}

export function formatarFichaCliente(ficha: FichaCliente): string | null {
  const temAlgo = ficha.nome || ficha.endereco || ficha.ultimosPedidos.length > 0
  if (!temAlgo) return null

  const linhas = [
    '',
    '## Sobre este cliente (do cadastro da padaria)',
    ficha.nome ? `- Nome: ${ficha.nome}` : null,
    ficha.endereco ? `- Endereço salvo: ${ficha.endereco}` : null,
    ficha.observacao ? `- Observação da equipe: ${ficha.observacao}` : null,
    ficha.ultimosPedidos.length > 0
      ? `- Últimos pedidos: ${ficha.ultimosPedidos.map((p) => `${p.produto} (${p.quando})`).join('; ')}`
      : null,
    ficha.nome
      ? `- Este é um cliente CONHECIDO: ao cumprimentar, use o nome dele (ex: "Bom dia, ${ficha.nome}! 😊"). Nas demais mensagens, use o nome com moderação.`
      : null,
    '- No delivery, se houver endereço salvo, OFEREÇA entregar nele',
    '  ("Entrego no mesmo endereço, Rua X?") — mas SEMPRE confirme antes.',
    '- NÃO recite o histórico de pedidos; use só se ajudar a conversa.',
  ]
  return linhas.filter((l) => l !== null).join('\n')
}
