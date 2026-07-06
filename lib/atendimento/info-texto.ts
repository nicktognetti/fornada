// Bloco de informações OFICIAIS da loja para o prompt (PURO, testável).
// O que estiver aqui o robô PODE informar; o que não estiver, ele
// continua confirmando com a equipe (regra de ouro intacta).

export type InfoLoja = {
  horarios: string | null
  endereco: string | null
  pagamento: string | null
  entrega: string | null
  extra: string | null
}

export function formatarInfoLoja(info: InfoLoja | null): string | null {
  if (!info) return null
  const temAlgo = info.horarios || info.endereco || info.pagamento || info.entrega || info.extra
  if (!temAlgo) return null

  const linhas = [
    '',
    '## Informações OFICIAIS desta loja (você PODE informar ao cliente)',
    info.horarios ? `- Horários de funcionamento: ${info.horarios}` : null,
    info.endereco ? `- Endereço da loja: ${info.endereco}` : null,
    info.pagamento ? `- Formas de pagamento: ${info.pagamento}` : null,
    info.entrega ? `- Entrega (taxa/área/tempo): ${info.entrega}` : null,
    info.extra ? `- Outras informações: ${info.extra}` : null,
    '- O que NÃO estiver listado acima continua valendo a regra de ouro:',
    '  confirme com a equipe, nunca invente.',
  ]
  return linhas.filter((l) => l !== null).join('\n')
}
