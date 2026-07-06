// Conversa com a IA (Groq — llama-3.3-70b, camada gratuita, formato
// OpenAI-compatible) + transcrição de áudio (Whisper no Groq).
// A ferramenta consultar_produtos busca no catálogo da LOJA e do CANAL
// do número que recebeu a mensagem.

import { montarPrompt } from './prompt'
import { buscarProdutos } from './catalogo'
import { limparVazamentoDeFerramenta } from './marcadores'
import type { MensagemDaConversa } from './memoria'
import type { CanalCtx } from './canal'

const RESPOSTA_DE_EMERGENCIA =
  'Desculpe, estou com uma instabilidade no momento. 🙏 Pode tentar de novo em instantes?'

const FERRAMENTAS = [
  {
    type: 'function',
    function: {
      name: 'consultar_produtos',
      description:
        'Consulta os produtos, preços e disponibilidade no Fornada (o sistema oficial da padaria). Use sempre que o cliente perguntar sobre um produto, preço ou se algo está disponível.',
      parameters: {
        type: 'object',
        properties: {
          termo: {
            type: 'string',
            description: "Nome (ou parte do nome) do produto, ex: 'bolo de fubá'",
          },
        },
        required: ['termo'],
      },
    },
  },
]

/** Gera a resposta do agente para a mensagem do cliente. */
export async function gerarResposta(
  ctx: CanalCtx,
  mensagemDoCliente: string,
  historico: MensagemDaConversa[] = [],
  fichaCliente?: string | null,
  infoLoja?: string | null,
): Promise<string> {
  const chave = process.env.GROQ_API_KEY
  if (!chave) {
    console.error('ERRO: GROQ_API_KEY não configurada no ambiente.')
    return RESPOSTA_DE_EMERGENCIA
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mensagens: any[] = [
    { role: 'system', content: montarPrompt(ctx.canal, ctx.unidadeNome, fichaCliente, infoLoja) },
    ...historico,
    { role: 'user', content: mensagemDoCliente },
  ]

  const chamarGroq = (usarFerramentas: boolean) =>
    fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${chave}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: mensagens,
        // WhatsApp pede respostas curtas
        max_tokens: 500,
        ...(usarFerramentas ? { tools: FERRAMENTAS, tool_choice: 'auto' } : {}),
      }),
    })

  // Laço da conversa: normalmente 1 volta; se a IA usar a ferramenta,
  // executamos a consulta e voltamos com o resultado.
  let usarFerramentas = true
  let retriesDeFerramenta = 0
  for (let volta = 0; volta < 5; volta++) {
    const resposta = await chamarGroq(usarFerramentas)

    if (!resposta.ok) {
      const corpo = await resposta.text()
      // Quirk do llama no Groq: às vezes ele erra a SINTAXE da chamada de
      // ferramenta e a API devolve 400 tool_use_failed. Tentamos de novo;
      // na 2ª falha, repetimos SEM ferramentas (resposta simples é melhor
      // que mensagem de erro).
      if (corpo.includes('tool_use_failed') && retriesDeFerramenta < 2) {
        retriesDeFerramenta++
        if (retriesDeFerramenta >= 2) usarFerramentas = false
        console.warn(`Groq tool_use_failed — tentativa ${retriesDeFerramenta + 1}.`)
        continue
      }
      console.error('Falha na chamada do Groq:', resposta.status, corpo)
      return RESPOSTA_DE_EMERGENCIA
    }

    const dados = await resposta.json()
    const mensagemDaIA = dados?.choices?.[0]?.message

    if (mensagemDaIA?.tool_calls?.length) {
      mensagens.push(mensagemDaIA)

      for (const chamada of mensagemDaIA.tool_calls) {
        let resultado = 'Ferramenta desconhecida.'

        if (chamada?.function?.name === 'consultar_produtos') {
          try {
            const argumentos = JSON.parse(chamada.function.arguments || '{}')
            const produtos = await buscarProdutos(argumentos.termo || '', ctx.unidadeId, ctx.canal)

            if (produtos === null) {
              resultado =
                'Sistema Fornada indisponível no momento. Diga ao cliente que vai confirmar com a equipe.'
            } else if (produtos.length === 0) {
              resultado =
                'Nenhum produto encontrado com esse nome no Fornada. Diga ao cliente que vai confirmar com a equipe.'
            } else {
              // A IA recebe "tem_foto" (sim/não) em vez da URL — quem envia
              // a foto é o sistema, via marcação #FOTO#
              resultado = JSON.stringify(
                produtos.map(({ foto_url, ...produto }) => ({
                  ...produto,
                  tem_foto: !!foto_url,
                }))
              )
            }

            console.log(
              `🔌 Catálogo [${ctx.canal}/${ctx.unidadeNome}]: consultar_produtos("${argumentos.termo}") → ` +
                (produtos === null ? 'indisponível' : `${produtos.length} resultado(s)`)
            )
          } catch (erro) {
            console.error('Erro ao executar consultar_produtos:', erro)
            resultado = 'Erro na consulta. Diga ao cliente que vai confirmar com a equipe.'
          }
        }

        mensagens.push({ role: 'tool', tool_call_id: chamada.id, content: resultado })
      }

      continue // volta pra IA com os resultados
    }

    const texto = mensagemDaIA?.content
    if (texto) {
      const limpo = limparVazamentoDeFerramenta(texto)
      if (limpo) return limpo
      // A "resposta" era só a chamada vazada — tenta de novo sem ferramentas
      usarFerramentas = false
      continue
    }

    console.error('Groq respondeu sem texto:', JSON.stringify(dados))
    return RESPOSTA_DE_EMERGENCIA
  }

  console.error('IA passou do limite de voltas sem responder.')
  return RESPOSTA_DE_EMERGENCIA
}

/** Transcreve um áudio para texto (Whisper no Groq). */
export async function transcreverAudio(
  dados: ArrayBuffer,
  mimeType: string,
): Promise<string | null> {
  const chave = process.env.GROQ_API_KEY
  if (!chave) {
    console.error('ERRO: GROQ_API_KEY não configurada no ambiente.')
    return null
  }

  const formulario = new FormData()
  formulario.append('model', 'whisper-large-v3-turbo')
  formulario.append('language', 'pt')
  formulario.append('response_format', 'text')
  formulario.append('file', new Blob([dados], { type: mimeType }), 'audio.ogg')

  const resposta = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}` },
    body: formulario,
  })

  if (!resposta.ok) {
    console.error('Falha na transcrição do áudio:', resposta.status, await resposta.text())
    return null
  }

  const texto = (await resposta.text()).trim()
  return texto || null
}
