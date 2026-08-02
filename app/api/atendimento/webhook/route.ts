// Webhook do WhatsApp Cloud API (módulo Atendimento).
// A Meta chama esta rota de duas formas:
//   GET  -> uma única vez, para VERIFICAR que o webhook é seu
//   POST -> toda vez que chega uma mensagem (ou atualização de status)
//
// O phone_number_id do payload identifica QUAL número recebeu a mensagem
// → resolvemos (unidade, canal) em atendimento_canal. Encomendas e
// Delivery são números separados, com prompt e catálogo próprios.

import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { resolverCanal, type CanalCtx } from '@/lib/atendimento/canal'
import { enviarMensagemTexto, enviarImagem, baixarMidia } from '@/lib/atendimento/whatsapp'
import { gerarResposta, transcreverAudio } from '@/lib/atendimento/ia'
import { extrairEncomenda, extrairFoto } from '@/lib/atendimento/marcadores'
import { buscarProdutos } from '@/lib/atendimento/catalogo'
import {
  obterOuCriarConversa,
  buscarHistorico,
  salvarMensagens,
  salvarEncomendaAnotada,
  contarMensagensRecentes,
  registrarEventoWebhook,
} from '@/lib/atendimento/memoria'
import { validarAssinatura } from '@/lib/atendimento/assinatura'
import { alertarAdmin } from '@/lib/atendimento/alerta'
import { avisarEquipe } from '@/lib/atendimento/aviso'
import { upsertClienteAtendimento, buscarFichaCliente } from '@/lib/atendimento/cliente'
import { criarPedidoAutomatico } from '@/lib/atendimento/pedido-auto'
import { buscarInfoLoja } from '@/lib/atendimento/info-loja'

/**
 * GET /api/atendimento/webhook — verificação do webhook (cadastro na Meta).
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    console.log('Webhook do atendimento verificado com sucesso!')
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Token de verificação inválido', { status: 403 })
}

/**
 * POST /api/atendimento/webhook — mensagens e status da Meta.
 * SEMPRE devolve 200 rápido (senão a Meta reenvia); o trabalho pesado
 * roda depois da resposta, via after().
 */
// Anti-abuso: acima disso de mensagens do cliente por janela, o robô
// para de chamar a IA (mensagens continuam salvas e visíveis no painel).
const LIMITE_POR_MINUTO = 6
const LIMITE_POR_HORA = 40

// O trabalho pesado (IA + envio) roda no after(), DEPOIS do 200. Sem isso,
// o runtime pode encerrar a função no meio: resposta não enviada e nada salvo.
export const maxDuration = 60

/** Telefone em log: só os 4 últimos dígitos (o número inteiro fica no banco). */
function mascarar(numero: string | undefined): string {
  if (!numero) return '???'
  return '***' + numero.slice(-4)
}

export async function POST(request: NextRequest) {
  try {
    // Corpo CRU primeiro: a assinatura da Meta é o HMAC destes bytes.
    const corpoCru = await request.text()
    const assinatura = validarAssinatura(
      corpoCru,
      request.headers.get('x-hub-signature-256'),
      process.env.META_APP_SECRET,
    )
    if (assinatura === 'invalida') {
      console.error('Webhook com assinatura INVÁLIDA — requisição rejeitada (não é a Meta).')
      return new NextResponse('Assinatura inválida', { status: 401 })
    }
    if (assinatura === 'sem-secret') {
      // Em produção falha FECHADO: sem o secret não há como saber se o POST
      // veio mesmo da Meta, e aceitar significa deixar qualquer um disparar
      // a IA e gravar conversas. Em dev, segue com aviso.
      if (process.env.NODE_ENV === 'production') {
        console.error('META_APP_SECRET ausente em produção — webhook REJEITADO.')
        after(
          alertarAdmin(
            'Webhook (configuração)',
            'META_APP_SECRET não está configurado — o robô está recusando mensagens. Cadastre o secret na Vercel.',
          )
        )
        return new NextResponse('Webhook não configurado', { status: 401 })
      }
      console.warn('META_APP_SECRET não configurado — aceito apenas fora de produção.')
    }

    const payload = JSON.parse(corpoCru)

    // entry[], changes[] e messages[] são ARRAYS na Meta e podem vir com
    // vários itens (cliente manda 3 mensagens em rajada, redelivery em lote).
    // Pegar só o [0] descartava mensagens de cliente em silêncio.
    for (const entry of payload?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value

        // Confirmações de entrega/leitura das NOSSAS mensagens: só log.
        if (value?.statuses) {
          for (const status of value.statuses) {
            console.log(
              `Status da mensagem para ${mascarar(status?.recipient_id)}: ${status?.status}` +
                (status?.errors ? ` | ERROS: ${JSON.stringify(status.errors)}` : '')
            )
          }
          continue
        }

        const mensagens = value?.messages ?? []
        if (mensagens.length === 0) continue

        // De QUAL número da padaria veio? (define loja + canal)
        const ctx = await resolverCanal(value?.metadata?.phone_number_id)
        if (!ctx) continue

        const nomePerfil: string | null = value?.contacts?.[0]?.profile?.name ?? null

        for (const mensagem of mensagens) {
          // Idempotência: a Meta reenvia webhooks. Sem isto, a reentrega
          // gerava resposta e pedido duplicados.
          if (!(await registrarEventoWebhook(mensagem?.id, ctx))) {
            console.log(`Mensagem ${mensagem?.id} já processada (reentrega da Meta) — ignorada.`)
            continue
          }

          if (mensagem.type === 'text') {
            console.log(`[${ctx.canal}/${ctx.unidadeNome}] Mensagem de ${mascarar(mensagem.from)} (${mensagem.text.body.length} chars)`)
            after(responderComIA(ctx, mensagem.from, nomePerfil, mensagem.text.body))
          } else if (mensagem.type === 'audio') {
            console.log(`[${ctx.canal}/${ctx.unidadeNome}] Áudio de ${mascarar(mensagem.from)}`)
            after(responderAudio(ctx, mensagem.from, nomePerfil, mensagem.audio?.id))
          } else {
            console.log(`Mensagem de tipo "${mensagem.type}" não suportada.`)
            after(
              enviarMensagemTexto(
                ctx.phoneNumberId,
                mensagem.from,
                'Por enquanto eu só consigo entender mensagens de texto e áudio. 😊 Pode me escrever ou mandar um áudio?'
              )
            )
          }
        }
      }
    }

    return new NextResponse('OK', { status: 200 })
  } catch (erro) {
    // Mesmo com erro interno, 200 — senão a Meta fica reenviando
    console.error('Erro ao processar webhook:', erro)
    return new NextResponse('OK', { status: 200 })
  }
}

/** Gera a resposta com a IA e envia (roda após o 200, via after). */
async function responderComIA(
  ctx: CanalCtx,
  numeroRemetente: string,
  nomePerfil: string | null,
  textoRecebido: string,
) {
  try {
    const conversa = await obterOuCriarConversa(ctx, numeroRemetente, nomePerfil)
    if (!conversa) return

    // A mensagem do cliente é gravada ANTES de chamar a IA. Antes ela só era
    // salva no fim do fluxo feliz: se a IA ou o envio falhassem, o que o
    // cliente escreveu não aparecia no painel nem no histórico — a equipe nem
    // sabia que ele tinha perguntado. Também torna o anti-abuso confiável,
    // porque o contador enxerga a mensagem atual.
    await salvarMensagens(ctx, conversa.id, [{ role: 'user', content: textoRecebido }])

    // Atendente humano assumiu? IA fica MUDA — a mensagem já está salva
    // e aparece no painel.
    if (conversa.pausada) {
      console.log(`Conversa ${conversa.id} pausada (humano no controle) — IA não respondeu.`)
      return
    }

    // Anti-abuso: número metralhando mensagens não gasta IA nem envio.
    // Os contadores já incluem a mensagem atual (salva acima), por isso `>`.
    const [porMinuto, porHora] = await Promise.all([
      contarMensagensRecentes(conversa.id, 60),
      contarMensagensRecentes(conversa.id, 3600),
    ])
    if (porMinuto > LIMITE_POR_MINUTO || porHora > LIMITE_POR_HORA) {
      console.warn(`Anti-abuso: ${mascarar(numeroRemetente)} excedeu o limite (${porMinuto}/min, ${porHora}/h) — IA não respondeu.`)
      return
    }

    // Ficha do cliente (se o número já é conhecido) entra no prompt:
    // o robô cumprimenta pelo nome e oferece o endereço salvo.
    const [historico, fichaCliente, infoLoja] = await Promise.all([
      buscarHistorico(conversa.id),
      buscarFichaCliente(ctx, numeroRemetente),
      buscarInfoLoja(ctx.unidadeId),
    ])
    if (fichaCliente) console.log(`👤 Cliente conhecido (${mascarar(numeroRemetente)}) — ficha aplicada ao prompt.`)
    const respostaDaIA = await gerarResposta(ctx, textoRecebido, historico, fichaCliente, infoLoja)

    // Marcações internas (encomenda/foto): captura os dados e limpa o texto
    const extracao = extrairEncomenda(respostaDaIA)
    const { textoLimpo, produtoDaFoto } = extrairFoto(extracao.textoLimpo)

    if (extracao.encomenda) {
      console.log(`📝 [${ctx.canal}] Pedido anotado de ${mascarar(numeroRemetente)}: "${extracao.encomenda.produto}"`)
      // null = duplicata (cliente confirmou 2×) → não avisa nem cria de novo
      const anotadaId = await salvarEncomendaAnotada(ctx, conversa.id, extracao.encomenda)
      if (anotadaId) {
        await Promise.all([
          // Cadastro de cliente (nome/telefone/endereço) para a próxima visita
          upsertClienteAtendimento(ctx, numeroRemetente, extracao.encomenda, nomePerfil),
          // Aviso no WhatsApp da equipe (se ligado para este canal/unidade)
          avisarEquipe(ctx, extracao.encomenda, numeroRemetente),
          // Encomenda oficial automática (se ligado — pensado para delivery)
          criarPedidoAutomatico(ctx, anotadaId, extracao.encomenda, numeroRemetente),
        ])
      }
    }

    // A IA pediu para mandar foto? Busca a URL no catálogo e envia a
    // imagem com o texto como legenda.
    let enviadoComFoto = false
    if (produtoDaFoto) {
      const produtos = await buscarProdutos(produtoDaFoto, ctx.unidadeId, ctx.canal)
      const produtoComFoto = produtos?.find((p) => p.foto_url)
      if (produtoComFoto?.foto_url) {
        enviadoComFoto = await enviarImagem(
          ctx.phoneNumberId,
          numeroRemetente,
          produtoComFoto.foto_url,
          textoLimpo
        )
      }
    }

    // Sem foto (ou foto falhou): texto normal. Cliente NUNCA fica sem resposta.
    let entregue = enviadoComFoto
    if (!enviadoComFoto) {
      entregue = await enviarMensagemTexto(ctx.phoneNumberId, numeroRemetente, textoLimpo)
    }

    // A mensagem do cliente já foi salva no início; aqui entra só a resposta.
    // Se o envio falhou (janela de 24h expirada, número bloqueado, erro da
    // Graph API), marcamos no histórico e alertamos: sem isso o painel mostrava
    // a conversa como "respondida" e o cliente tinha ficado no vácuo.
    await salvarMensagens(ctx, conversa.id, [
      {
        role: 'assistant',
        content: entregue
          ? (enviadoComFoto ? `📷 ${textoLimpo}` : textoLimpo)
          : `⚠️ NÃO ENTREGUE ao cliente: ${textoLimpo}`,
      },
    ])
    if (!entregue) {
      console.error(`Resposta NÃO entregue a ${mascarar(numeroRemetente)} (conversa ${conversa.id}).`)
      await alertarAdmin(
        'Envio ao cliente',
        `Falha ao entregar a resposta para ${mascarar(numeroRemetente)} (${ctx.canal}/${ctx.unidadeNome}). A conversa está no painel.`,
        ctx.phoneNumberId,
      )
    }
  } catch (erro) {
    console.error('Erro ao gerar/enviar resposta da IA:', erro)
    await alertarAdmin('Webhook (responder cliente)', erro instanceof Error ? erro.message : String(erro), ctx.phoneNumberId)
  }
}

/** Áudio: baixa, transcreve (Whisper) e segue como texto. */
async function responderAudio(
  ctx: CanalCtx,
  numeroRemetente: string,
  nomePerfil: string | null,
  audioId?: string,
) {
  try {
    const avisoDeFalha = 'Não consegui ouvir seu áudio direito. 🙏 Pode escrever ou tentar de novo?'

    if (!audioId) {
      await enviarMensagemTexto(ctx.phoneNumberId, numeroRemetente, avisoDeFalha)
      return
    }

    const midia = await baixarMidia(audioId)
    if (!midia) {
      await enviarMensagemTexto(ctx.phoneNumberId, numeroRemetente, avisoDeFalha)
      return
    }

    const transcricao = await transcreverAudio(midia.dados, midia.mimeType)
    if (!transcricao) {
      await enviarMensagemTexto(ctx.phoneNumberId, numeroRemetente, avisoDeFalha)
      return
    }

    console.log(`Áudio de ${mascarar(numeroRemetente)} transcrito (${transcricao.length} chars).`)
    await responderComIA(ctx, numeroRemetente, nomePerfil, transcricao)
  } catch (erro) {
    console.error('Erro ao tratar áudio:', erro)
  }
}
