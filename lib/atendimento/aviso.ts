// Aviso de pedido novo no WhatsApp da equipe.
// Liga/desliga por (unidade, canal) em atendimento_canal.avisar_ativo —
// configurável na aba "Robô" do painel de Atendimento.

import { supabaseAdmin } from '@/lib/supabase/admin'
import { enviarMensagemTexto, enviarTemplate } from './whatsapp'
import { formatarAvisoPedido, formatarAvisoPedidoLinha } from './aviso-texto'
import type { CanalCtx } from './canal'
import type { DadosDaEncomenda } from './marcadores'

/**
 * Se o aviso estiver LIGADO para este canal/unidade, manda o resumo do
 * pedido para o número da equipe. Falha aqui nunca derruba o atendimento.
 */
export async function avisarEquipe(
  ctx: CanalCtx,
  dados: DadosDaEncomenda,
  numeroCliente: string,
): Promise<void> {
  try {
    const { data: canal } = await supabaseAdmin
      .from('atendimento_canal')
      .select('avisar_ativo, avisar_numero, avisar_template')
      .eq('unidade_id', ctx.unidadeId)
      .eq('canal', ctx.canal)
      .maybeSingle()

    if (!canal?.avisar_ativo || !canal.avisar_numero?.trim()) return
    const destino = canal.avisar_numero.trim()

    // Com template aprovado na Meta: fura a janela de 24h (aviso SEMPRE chega).
    // Sem template: mensagem livre (precisa da janela) — e vice-versa de fallback.
    let ok = false
    const template = canal.avisar_template?.trim()
    if (template) {
      const linha = formatarAvisoPedidoLinha(ctx.canal, dados, ctx.unidadeNome, numeroCliente)
      ok = await enviarTemplate(ctx.phoneNumberId, destino, template, linha)
      if (!ok) {
        console.warn(`Template "${template}" falhou — tentando mensagem livre.`)
        ok = await enviarMensagemTexto(ctx.phoneNumberId, destino,
          formatarAvisoPedido(ctx.canal, dados, ctx.unidadeNome, numeroCliente))
      }
    } else {
      const texto = formatarAvisoPedido(ctx.canal, dados, ctx.unidadeNome, numeroCliente)
      ok = await enviarMensagemTexto(ctx.phoneNumberId, destino, texto)
    }
    console.log(
      ok
        ? `🔔 Equipe avisada (${ctx.canal}/${ctx.unidadeNome}) no ${destino}${template ? ' via template' : ''}.`
        : `🔔 Aviso à equipe FALHOU (${ctx.canal}/${ctx.unidadeNome}) — veja o erro acima. ` +
          'Sem template aprovado, a Meta exige que a equipe fale com o robô a cada 24h.'
    )
  } catch (erro) {
    console.error('Erro ao avisar a equipe (pedido segue anotado no painel):', erro)
  }
}
