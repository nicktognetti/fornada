// Marcações internas que a IA usa na resposta (#ENCOMENDA# e #FOTO#).
// Funções PURAS: recebem o texto da IA e devolvem o texto limpo (o que o
// cliente vê) + os dados extraídos. O cliente NUNCA pode receber "código".

// Um item do pedido (quantidade é texto livre do cliente: "2kg", "10 unidades")
export type ItemDaEncomenda = {
  produto: string
  quantidade: string
}

// Dados de um pedido/encomenda anotado pelo agente.
// No canal encomendas: data = dia/horário de retirada que o cliente falou.
// No canal delivery: endereco = onde entregar (data costuma ser "hoje").
// `itens` = lista estruturada; `produto`/`quantidade` = resumo (compat).
export type DadosDaEncomenda = {
  produto: string
  quantidade: string
  data: string
  nome: string
  endereco: string | null
  itens: ItemDaEncomenda[]
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

    // Multi-itens: a IA manda "itens":[{produto,quantidade},...]. Se vier só
    // produto/quantidade soltos (formato antigo), viram um item único.
    let itens: ItemDaEncomenda[] = []
    if (Array.isArray(dados.itens)) {
      itens = dados.itens
        .filter((i: unknown) => i && typeof i === 'object' && (i as { produto?: unknown }).produto)
        .map((i: { produto: unknown; quantidade?: unknown }) => ({
          produto: String(i.produto),
          quantidade: String(i.quantidade || '?'),
        }))
    }
    if (itens.length === 0 && dados.produto) {
      itens = [{ produto: String(dados.produto), quantidade: String(dados.quantidade || '?') }]
    }
    if (itens.length === 0) {
      console.error('Marcação de encomenda sem itens (linha removida).')
      return { textoLimpo, encomenda: null }
    }

    // Resumo em texto (exibição no painel, comanda e anti-duplicata)
    const produto = itens.length === 1
      ? itens[0].produto
      : itens.map((i) => (i.quantidade !== '?' ? `${i.quantidade} ${i.produto}` : i.produto)).join(' + ')
    const quantidade = itens.length === 1 ? itens[0].quantidade : `${itens.length} itens`

    return {
      textoLimpo,
      encomenda: {
        produto,
        quantidade,
        data: String(dados.data || '?'),
        nome: String(dados.nome || '?'),
        endereco: dados.endereco ? String(dados.endereco) : null,
        itens,
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
