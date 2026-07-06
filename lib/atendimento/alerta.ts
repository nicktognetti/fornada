// Alerta de ERRO CRÍTICO do robô no WhatsApp do administrador.
// Liga configurando o env ALERTA_WHATSAPP (número com DDI). Sem ele,
// os erros ficam só nos logs da Vercel (como antes).
//
// Trava anti-spam: no máximo 1 alerta a cada 30 min por tipo de origem
// (em memória — na Vercel com Fluid Compute a instância é reutilizada;
// no pior caso chega um alerta extra, nunca uma enxurrada).

import { enviarMensagemTexto } from './whatsapp'

const INTERVALO_MINUTOS = 30
const ultimoAlerta = new Map<string, number>()

/**
 * Manda "🚨 Robô com problema" pro admin. Nunca lança erro (alerta que
 * falha não pode derrubar nada).
 */
export async function alertarAdmin(origem: string, detalhe: string, phoneNumberId?: string): Promise<void> {
  try {
    const destino = process.env.ALERTA_WHATSAPP?.trim()
    const numeroEnvio = phoneNumberId || process.env.PHONE_NUMBER_ID
    if (!destino || !numeroEnvio) return

    const agora = Date.now()
    const anterior = ultimoAlerta.get(origem) ?? 0
    if (agora - anterior < INTERVALO_MINUTOS * 60_000) return
    ultimoAlerta.set(origem, agora)

    const texto =
      `🚨 Robô do Fornada com problema\n\n` +
      `Onde: ${origem}\n` +
      `Detalhe: ${detalhe.slice(0, 400)}\n\n` +
      `Os clientes recebem a mensagem de instabilidade enquanto isso. ` +
      `Veja os logs na Vercel.`
    await enviarMensagemTexto(numeroEnvio, destino, texto)
  } catch (erro) {
    console.error('Falha ao enviar alerta ao admin (só log):', erro)
  }
}
