// Métricas do funil do robô. Função PURA (sem banco) para ser testada — é o
// número que prova (ou não) que o agente está valendo a pena.
//
// O relatório antigo começava na ANOTAÇÃO: sabia quantos pedidos o robô anotou,
// mas não quantas pessoas falaram com ele. Sem o topo do funil não dá para
// responder "de cada 10 clientes que chamam no WhatsApp, quantos compram?".

export type MensagemMetrica = {
  conversa_id: string
  role: 'user' | 'assistant'
  criado_em: string
}

export type FunilRobo = {
  /** Conversas com pelo menos uma mensagem no período (clientes atendidos). */
  conversasAtendidas: number
  /** Conversas em que o robô anotou ao menos 1 pedido. */
  conversasComPedido: number
  /** conversasComPedido / conversasAtendidas, em %. */
  taxaConversao: number
  mensagensCliente: number
  mensagensRobo: number
  /** Média de mensagens (das duas pontas) por conversa. */
  mediaMensagensPorConversa: number
  /** Mediana do tempo entre a fala do cliente e a resposta do robô, em segundos. */
  medianaRespostaSegundos: number | null
}

/** Mediana (não média: uma resposta travada de 5 min distorceria a média). */
function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null
  const ord = [...valores].sort((a, b) => a - b)
  const meio = Math.floor(ord.length / 2)
  return ord.length % 2 === 0 ? (ord[meio - 1] + ord[meio]) / 2 : ord[meio]
}

/**
 * Monta o funil a partir das mensagens do período e das conversas que geraram
 * pedido anotado.
 *
 * O tempo de resposta considera cada par cliente→robô dentro da MESMA conversa,
 * em ordem cronológica. Mensagens do cliente em sequência (ele mandou 3 seguidas)
 * contam a partir da PRIMEIRA — é quando ele começou a esperar.
 */
export function calcularFunil(
  mensagens: MensagemMetrica[],
  conversasComPedido: Set<string>,
): FunilRobo {
  const porConversa = new Map<string, MensagemMetrica[]>()
  let mensagensCliente = 0
  let mensagensRobo = 0

  for (const m of mensagens) {
    if (m.role === 'user') mensagensCliente++
    else mensagensRobo++
    if (!porConversa.has(m.conversa_id)) porConversa.set(m.conversa_id, [])
    porConversa.get(m.conversa_id)!.push(m)
  }

  const esperas: number[] = []
  for (const msgs of porConversa.values()) {
    const ordenadas = [...msgs].sort(
      (a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime(),
    )
    // Início da espera: primeira mensagem do cliente após uma resposta do robô.
    let aguardandoDesde: number | null = null
    for (const m of ordenadas) {
      const t = new Date(m.criado_em).getTime()
      if (Number.isNaN(t)) continue
      if (m.role === 'user') {
        if (aguardandoDesde === null) aguardandoDesde = t
      } else if (aguardandoDesde !== null) {
        const delta = (t - aguardandoDesde) / 1000
        if (delta >= 0) esperas.push(delta)
        aguardandoDesde = null
      }
    }
  }

  const conversasAtendidas = porConversa.size
  // Só conta conversa que teve pedido E atividade no período.
  const comPedido = [...conversasComPedido].filter((id) => porConversa.has(id)).length
  const totalMensagens = mensagensCliente + mensagensRobo

  return {
    conversasAtendidas,
    conversasComPedido: comPedido,
    taxaConversao: conversasAtendidas > 0 ? Math.round((comPedido / conversasAtendidas) * 100) : 0,
    mensagensCliente,
    mensagensRobo,
    mediaMensagensPorConversa:
      conversasAtendidas > 0 ? Math.round((totalMensagens / conversasAtendidas) * 10) / 10 : 0,
    medianaRespostaSegundos: mediana(esperas),
  }
}

/** "12s", "1min 30s", "2h 5min" — para exibição. */
export function formatDuracaoCurta(segundos: number | null): string {
  if (segundos === null) return '—'
  const s = Math.round(segundos)
  if (s < 60) return `${s}s`
  const min = Math.floor(s / 60)
  if (min < 60) {
    const resto = s % 60
    return resto > 0 ? `${min}min ${resto}s` : `${min}min`
  }
  const h = Math.floor(min / 60)
  const restoMin = min % 60
  return restoMin > 0 ? `${h}h ${restoMin}min` : `${h}h`
}
