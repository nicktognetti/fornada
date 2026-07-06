// Aviso de pedido novo no WhatsApp da equipe.
// Liga/desliga por (unidade, canal) em atendimento_canal.avisar_ativo —
// configurável na aba "Robô" do painel de Atendimento.

import { supabaseAdmin } from '@/lib/supabase/admin'
import { enviarMensagemTexto } from './whatsapp'
import { formatarAvisoPedido } from './aviso-texto'
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
      .select('avisar_ativo, avisar_numero')
      .eq('unidade_id', ctx.unidadeId)
      .eq('canal', ctx.canal)
      .maybeSingle()

    if (!canal?.avisar_ativo || !canal.avisar_numero?.trim()) return

    const texto = formatarAvisoPedido(ctx.canal, dados, ctx.unidadeNome, numeroCliente)
    const ok = await enviarMensagemTexto(ctx.phoneNumberId, canal.avisar_numero.trim(), texto)
    console.log(
      ok
        ? `🔔 Equipe avisada (${ctx.canal}/${ctx.unidadeNome}) no ${canal.avisar_numero}.`
        : `🔔 Aviso à equipe FALHOU (${ctx.canal}/${ctx.unidadeNome}) — veja o erro acima. ` +
          'Lembrete: fora da janela de 24h a Meta pode exigir template; peça para a equipe mandar um "oi" para o robô.'
    )
  } catch (erro) {
    console.error('Erro ao avisar a equipe (pedido segue anotado no painel):', erro)
  }
}
