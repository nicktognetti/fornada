// Funções para conversar com a API oficial do WhatsApp (Cloud API da Meta).
// O token é um só (por app da Meta, no env); o phone_number_id varia por
// canal/unidade — por isso vai como parâmetro (vem de atendimento_canal).

const GRAPH = 'https://graph.facebook.com/v25.0'

/** Envia uma mensagem de texto simples. */
export async function enviarMensagemTexto(
  phoneNumberId: string,
  para: string,
  texto: string,
): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN
  if (!token || !phoneNumberId) {
    console.error('ERRO: WHATSAPP_TOKEN ou phone_number_id ausentes.')
    return false
  }

  const resposta = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: para,
      type: 'text',
      text: { body: texto },
    }),
  })

  if (!resposta.ok) {
    console.error('Falha ao enviar mensagem:', resposta.status, await resposta.text())
    return false
  }
  return true
}

/**
 * Envia uma mensagem de TEMPLATE aprovado na Meta (corpo com {{1}}).
 * Templates furam a janela de 24h — usado no aviso à equipe.
 */
export async function enviarTemplate(
  phoneNumberId: string,
  para: string,
  templateNome: string,
  parametro: string,
): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN
  if (!token || !phoneNumberId) {
    console.error('ERRO: WHATSAPP_TOKEN ou phone_number_id ausentes.')
    return false
  }

  const resposta = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: para,
      type: 'template',
      template: {
        name: templateNome,
        language: { code: 'pt_BR' },
        components: [
          {
            type: 'body',
            // Parâmetro de template não aceita \n/\t — o chamador já manda em linha única
            parameters: [{ type: 'text', text: parametro.slice(0, 1024) }],
          },
        ],
      },
    }),
  })

  if (!resposta.ok) {
    console.error('Falha ao enviar template:', resposta.status, await resposta.text())
    return false
  }
  return true
}

/** Envia uma IMAGEM (foto de produto) com legenda opcional. */
export async function enviarImagem(
  phoneNumberId: string,
  para: string,
  urlDaImagem: string,
  legenda?: string,
): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN
  if (!token || !phoneNumberId) {
    console.error('ERRO: WHATSAPP_TOKEN ou phone_number_id ausentes.')
    return false
  }

  const resposta = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: para,
      type: 'image',
      image: {
        link: urlDaImagem,
        // Legenda tem limite de 1024 caracteres na API
        ...(legenda ? { caption: legenda.slice(0, 1024) } : {}),
      },
    }),
  })

  if (!resposta.ok) {
    console.error('Falha ao enviar imagem:', resposta.status, await resposta.text())
    return false
  }
  return true
}

/**
 * Baixa uma mídia (áudio) recebida pelo WhatsApp. A Meta manda só um ID
 * no webhook; o download é em dois passos (info → arquivo, URL expira ~5min).
 */
export async function baixarMidia(
  mediaId: string,
): Promise<{ dados: ArrayBuffer; mimeType: string } | null> {
  const token = process.env.WHATSAPP_TOKEN
  if (!token) {
    console.error('ERRO: WHATSAPP_TOKEN não configurado no ambiente.')
    return null
  }

  const respostaInfo = await fetch(`${GRAPH}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!respostaInfo.ok) {
    console.error('Falha ao buscar info da mídia:', respostaInfo.status, await respostaInfo.text())
    return null
  }
  const info = await respostaInfo.json()

  const respostaArquivo = await fetch(info.url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!respostaArquivo.ok) {
    console.error('Falha ao baixar a mídia:', respostaArquivo.status)
    return null
  }

  return {
    dados: await respostaArquivo.arrayBuffer(),
    mimeType: info.mime_type || 'audio/ogg',
  }
}
