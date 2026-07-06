// Pedido automático: com o toggle `pedido_auto` ligado no canal, o pedido
// anotado pelo robô já vira encomenda OFICIAL (sem valor, entrega hoje)
// no módulo de Encomendas — a equipe só confirma o valor depois.
// Roda no webhook → supabaseAdmin (sem sessão de usuário).

import { supabaseAdmin } from '@/lib/supabase/admin'
import type { CanalCtx } from './canal'
import type { DadosDaEncomenda } from './marcadores'

const FUSO_PADARIA = 'America/Sao_Paulo'

/** Hoje e agora no fuso da padaria. */
function agoraLocal(): { data: string; hora: string } {
  const agora = new Date()
  const data = agora.toLocaleDateString('sv', { timeZone: FUSO_PADARIA }) // YYYY-MM-DD
  const hora = agora.toLocaleTimeString('pt-BR', { timeZone: FUSO_PADARIA, hour: '2-digit', minute: '2-digit' })
  return { data, hora }
}

/**
 * Se `pedido_auto` estiver ligado para este canal/unidade, cria a
 * encomenda oficial e liga a anotação (status virou_pedido).
 * Falha aqui nunca derruba o atendimento (a anotação fica no painel).
 */
export async function criarPedidoAutomatico(
  ctx: CanalCtx,
  atendimentoEncomendaId: string,
  dados: DadosDaEncomenda,
  numeroCliente: string,
): Promise<void> {
  try {
    const { data: canal } = await supabaseAdmin
      .from('atendimento_canal')
      .select('pedido_auto')
      .eq('unidade_id', ctx.unidadeId)
      .eq('canal', ctx.canal)
      .maybeSingle()
    if (!canal?.pedido_auto) return

    const { data: hoje, hora } = agoraLocal()
    const clienteNome = dados.nome && dados.nome !== '?' ? dados.nome : numeroCliente

    const obs = [
      `Criado automaticamente pelo robô (${ctx.canal === 'delivery' ? 'Delivery' : 'Encomendas'})`,
      dados.quantidade && dados.quantidade !== '?' ? `Quantidade anotada: ${dados.quantidade}` : null,
      dados.endereco ? `Entregar em: ${dados.endereco}` : null,
      ctx.canal === 'encomendas' && dados.data ? `Cliente pediu para: ${dados.data}` : null,
      'VALOR EM ABERTO — confirmar com o cliente.',
    ].filter(Boolean).join(' · ')

    const { data: enc, error: e1 } = await supabaseAdmin
      .from('encomenda')
      .insert({
        empresa_id: ctx.empresaId,
        unidade_id: ctx.unidadeId,
        cliente_nome: clienteNome,
        cliente_contato: numeroCliente,
        data_entrega: hoje,
        hora_entrega: hora,
        com_valor: false,
        rastrear_status: true,
        total: 0,
        observacao: obs,
        status: 'pendente',
      })
      .select('id')
      .single()
    if (e1 || !enc) {
      console.error('Pedido automático: falha ao criar encomenda:', e1?.message)
      return
    }

    // Um item por produto anotado (multi-itens); fallback = item único
    const itens = dados.itens.length > 0
      ? dados.itens
      : [{ produto: dados.produto, quantidade: dados.quantidade }]
    const { error: e2 } = await supabaseAdmin.from('encomenda_item').insert(
      itens.map((i) => ({
        encomenda_id: enc.id,
        produto_id: null,
        descricao: i.produto,
        quantidade: 1,
        preco_unitario: 0,
        subtotal: 0,
        observacao: i.quantidade && i.quantidade !== '?' ? `Cliente pediu: ${i.quantidade}` : null,
        local: null,
      }))
    )
    if (e2) console.error('Pedido automático: falha nos itens:', e2.message)

    await supabaseAdmin.from('encomenda_status_log').insert({
      empresa_id: ctx.empresaId,
      unidade_id: ctx.unidadeId,
      encomenda_id: enc.id,
      status: 'pendente',
    })

    await supabaseAdmin
      .from('atendimento_encomenda')
      .update({ status: 'virou_pedido', encomenda_id: enc.id })
      .eq('id', atendimentoEncomendaId)

    console.log(`⚡ Pedido automático criado (${ctx.canal}/${ctx.unidadeNome}): encomenda ${enc.id}`)
  } catch (erro) {
    console.error('Erro no pedido automático (anotação segue no painel):', erro)
  }
}
