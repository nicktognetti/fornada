'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionResult = {
  error?: string
  success?: boolean
  codigo?: string
  transferencia_id?: string
}

async function getEmpresaId(userId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('usuario_empresa')
    .select('empresa_id')
    .eq('usuario_id', userId)
    .single()
  return data?.empresa_id ?? null
}

export async function createTransferenciaAction(data: {
  empresa_id: string
  unidade_origem_id: string
  unidade_destino_id: string
  tipo: 'TRANSFERENCIA' | 'DEVOLUCAO'
  observacao?: string
  itens: Array<{ produto_id: string; quantidade_enviada: number }>
}): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  if (data.itens.length === 0) return { error: 'Adicione pelo menos um item' }

  if (data.tipo === 'DEVOLUCAO' && !data.observacao?.trim()) {
    return { error: 'Informe o motivo da devolução' }
  }

  // Gerar código via função do banco (schema fornada)
  const { data: codigoData, error: codigoErr } = await supabase
    .schema('fornada')
    .rpc('fn_gerar_codigo_transferencia', { p_tipo: data.tipo })

  if (codigoErr || !codigoData) {
    return { error: 'Erro ao gerar código: ' + (codigoErr?.message ?? 'sem retorno') }
  }
  const codigo = codigoData as string

  // Inserir transferência já com status EM_TRANSITO
  const { data: transferencia, error: tErr } = await supabase
    .schema('fornada')
    .from('transferencia')
    .insert({
      empresa_id: data.empresa_id,
      unidade_origem_id: data.unidade_origem_id,
      unidade_destino_id: data.unidade_destino_id,
      tipo: data.tipo,
      codigo,
      status: 'EM_TRANSITO',
      responsavel_origem_id: user.id,
      observacao: data.observacao?.trim() || null,
    })
    .select('id')
    .single()

  if (tErr || !transferencia) {
    return { error: 'Erro ao criar transferência: ' + (tErr?.message ?? '') }
  }

  // Inserir itens
  const itens = data.itens.map((item) => ({
    transferencia_id: transferencia.id,
    produto_id: item.produto_id,
    quantidade_enviada: item.quantidade_enviada,
    status_item: 'PENDENTE',
  }))

  const { error: iErr } = await supabase
    .schema('fornada')
    .from('transferencia_item')
    .insert(itens)

  if (iErr) {
    return { error: 'Transferência criada, mas erro nos itens: ' + iErr.message }
  }

  revalidatePath('/dashboard/transferencias')
  return { success: true, codigo, transferencia_id: transferencia.id }
}

export async function confirmarRecebimentoAction(data: {
  transferencia_id: string
  responsavel_destino_id: string
  itens: Array<{
    id: string
    quantidade_recebida: number
    status_item: 'RECEBIDO' | 'DIFERENCA' | 'AUSENTE'
    motivo_divergencia?: string
  }>
}): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  // Atualizar cada item
  for (const item of data.itens) {
    const { error } = await supabase
      .schema('fornada')
      .from('transferencia_item')
      .update({
        quantidade_recebida: item.quantidade_recebida,
        status_item: item.status_item,
        motivo_divergencia: item.motivo_divergencia?.trim() || null,
      })
      .eq('id', item.id)

    if (error) return { error: 'Erro ao atualizar item: ' + error.message }
  }

  // Status final: RECEBIDO_COM_DIVERGENCIA se algum item divergiu
  const temDivergencia = data.itens.some(
    (i) => i.status_item === 'DIFERENCA' || i.status_item === 'AUSENTE'
  )
  const statusFinal = temDivergencia ? 'RECEBIDO_COM_DIVERGENCIA' : 'RECEBIDO'

  const { error: tErr } = await supabase
    .schema('fornada')
    .from('transferencia')
    .update({
      status: statusFinal,
      confirmed_at: new Date().toISOString(),
      responsavel_destino_id: data.responsavel_destino_id,
    })
    .eq('id', data.transferencia_id)

  if (tErr) return { error: 'Erro ao confirmar recebimento: ' + tErr.message }

  revalidatePath('/dashboard/transferencias')
  revalidatePath(`/dashboard/transferencias/${data.transferencia_id}`)
  return { success: true }
}
