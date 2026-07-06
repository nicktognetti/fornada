// Canais do atendimento: cada número de WhatsApp (phone_number_id da Meta)
// pertence a uma (unidade, canal). Encomendas e Delivery são números
// separados, com catálogos e comportamentos diferentes (pedido da Natali).

import { supabaseAdmin } from '@/lib/supabase/admin'
import type { CanalAtendimento } from './canal-tipos'

export type { CanalAtendimento }
export { CANAL_LABEL } from './canal-tipos'

/** Contexto resolvido de um número: de qual loja/canal a mensagem veio. */
export type CanalCtx = {
  empresaId: string
  unidadeId: string
  unidadeNome: string
  canal: CanalAtendimento
  phoneNumberId: string
}

/**
 * Resolve (unidade, canal) a partir do phone_number_id que a Meta manda
 * no webhook. Fallback: se o número não está cadastrado em
 * `atendimento_canal` mas bate com o PHONE_NUMBER_ID do ambiente (número
 * de teste), usa a primeira unidade ativa como canal de encomendas.
 * Retorna null se não reconhecer o número (mensagem é ignorada com log).
 */
export async function resolverCanal(phoneNumberId: string | undefined): Promise<CanalCtx | null> {
  if (!phoneNumberId) return null

  const { data: row } = await supabaseAdmin
    .from('atendimento_canal')
    .select('empresa_id, unidade_id, canal, ativo, unidade:unidade_id ( nome )')
    .eq('phone_number_id', phoneNumberId)
    .maybeSingle()

  if (row) {
    if (!row.ativo) return null
    const unidade = Array.isArray(row.unidade) ? row.unidade[0] : row.unidade
    return {
      empresaId: row.empresa_id,
      unidadeId: row.unidade_id,
      unidadeNome: unidade?.nome ?? '',
      canal: row.canal as CanalAtendimento,
      phoneNumberId,
    }
  }

  // Número de teste da Meta (ainda sem cadastro em atendimento_canal)
  if (phoneNumberId === process.env.PHONE_NUMBER_ID) {
    const { data: unidade } = await supabaseAdmin
      .from('unidade')
      .select('id, nome, empresa_id')
      .eq('ativo', true)
      .order('nome')
      .limit(1)
      .maybeSingle()
    if (!unidade) return null
    console.warn(
      `Atendimento: phone_number_id ${phoneNumberId} sem cadastro em atendimento_canal — usando fallback (${unidade.nome}, encomendas).`
    )
    return {
      empresaId: unidade.empresa_id,
      unidadeId: unidade.id,
      unidadeNome: unidade.nome,
      canal: 'encomendas',
      phoneNumberId,
    }
  }

  console.error(`Atendimento: phone_number_id desconhecido (${phoneNumberId}) — mensagem ignorada.`)
  return null
}

/**
 * Descobre o phone_number_id para ENVIAR mensagem numa (unidade, canal) —
 * usado quando o atendente responde pelo painel. Fallback: env.
 */
export async function phoneNumberIdParaEnvio(
  unidadeId: string,
  canal: CanalAtendimento,
): Promise<string | null> {
  const { data: row } = await supabaseAdmin
    .from('atendimento_canal')
    .select('phone_number_id, ativo')
    .eq('unidade_id', unidadeId)
    .eq('canal', canal)
    .maybeSingle()
  if (row?.ativo) return row.phone_number_id
  return process.env.PHONE_NUMBER_ID ?? null
}
