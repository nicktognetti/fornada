// Marcações internas que a IA usa na resposta (#ENCOMENDA# e #FOTO#).
// Funções PURAS: recebem o texto da IA e devolvem o texto limpo (o que o
// cliente vê) + os dados extraídos. O cliente NUNCA pode receber "código".

// Dados de um pedido/encomenda anotado pelo agente.
// No canal encomendas: data = dia/horário de retirada que o cliente falou.
// No canal delivery: endereco = onde entregar (data costuma ser "hoje").
export type DadosDaEncomenda = {
  produto: string
  quantidade: string
  data: string
  nome: string
  endereco: string | null
}

export function extrairEncomenda(respostaDaIA: string): {
  textoLimpo: string
  encomenda: DadosDaEncomenda | null
} {
  const marcador = '#ENCOMENDA#'

  if (!respostaDaIA.includes(marcador)) {
    return { textoLimpo: respostaDaIA, encomenda: null }
  }

  const linhas = respostaDaIA.split('\n')
  const linhaDaEncomenda = linhas.find((linha) => linha.includes(marcador))
  const textoLimpo = linhas
    .filter((linha) => !linha.includes(marcador))
    .join('\n')
    .trim()

  try {
    const json = linhaDaEncomenda!.split(marcador)[1].trim()
    const dados = JSON.parse(json)

    return {
      textoLimpo,
      encomenda: {
        produto: String(dados.produto || '?'),
        quantidade: String(dados.quantidade || '?'),
        data: String(dados.data || '?'),
        nome: String(dados.nome || '?'),
        endereco: dados.endereco ? String(dados.endereco) : null,
      },
    }
  } catch (erro) {
    console.error('Marcação de encomenda veio quebrada (linha removida):', erro)
    return { textoLimpo, encomenda: null }
  }
}

/**
 * O llama às vezes "vaza" a sintaxe de chamada de ferramenta no texto
 * (ex: "<function=consultar_produtos>{...}</function>"). O cliente nunca
 * pode ver isso — removemos qualquer resquício.
 */
export function limparVazamentoDeFerramenta(texto: string): string {
  return texto
    .replace(/<function=[\s\S]*?<\/function>/g, '')
    .replace(/<function=[^\n]*/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

export function extrairFoto(respostaDaIA: string): {
  textoLimpo: string
  produtoDaFoto: string | null
} {
  const marcador = '#FOTO#'

  if (!respostaDaIA.includes(marcador)) {
    return { textoLimpo: respostaDaIA, produtoDaFoto: null }
  }

  const linhas = respostaDaIA.split('\n')
  const linhaDaFoto = linhas.find((linha) => linha.includes(marcador))
  const textoLimpo = linhas
    .filter((linha) => !linha.includes(marcador))
    .join('\n')
    .trim()

  try {
    const json = linhaDaFoto!.split(marcador)[1].trim()
    const dados = JSON.parse(json)
    const produto = String(dados.produto || '').trim()

    return { textoLimpo, produtoDaFoto: produto || null }
  } catch (erro) {
    console.error('Marcação de foto veio quebrada (linha removida):', erro)
    return { textoLimpo, produtoDaFoto: null }
  }
}
