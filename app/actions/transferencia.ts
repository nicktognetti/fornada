'use server'

import { createClient } from '@/lib/supabase/server'
import { temAcesso } from '@/app/lib/authz'
import { revalidatePath } from 'next/cache'

export type ActionResult = {
  error?: string
  success?: boolean
  codigo?: string
  transferencia_id?: string
}


export async function createTransferenciaAction(data: {
  empresa_id: string
  unidade_origem_id: string
  unidade_destino_id: string
  tipo: 'TRANSFERENCIA' | 'DEVOLUCAO'
  observacao?: string
  itens: Array<{ produto_id: string; quantidade_enviada: number; preco_unitario: number }>
}): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!(await temAcesso(user.id, ['transferencias'], { unidadeId: data.unidade_origem_id })))
    return { error: 'Sem permissão para criar transferências nesta unidade' }

  if (data.itens.length === 0) return { error: 'Adicione pelo menos um item' }

  if (data.tipo === 'DEVOLUCAO' && !data.observacao?.trim()) {
    return { error: 'Informe o motivo da devolução' }
  }

  const { data: codigoData, error: codigoErr } = await supabase
    .rpc('fn_gerar_codigo_transferencia', { p_tipo: data.tipo })

  if (codigoErr || !codigoData) {
    return { error: 'Erro ao gerar código: ' + (codigoErr?.message ?? 'sem retorno') }
  }
  const codigo = codigoData as string

  const valorTotal = data.itens.reduce(
    (acc, item) => acc + item.quantidade_enviada * item.preco_unitario,
    0
  )

  // Inserir transferência já com status EM_TRANSITO
  const { data: transferencia, error: tErr } = await supabase
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
      valor_total: valorTotal,
      status_financeiro: 'pendente',
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
    preco_unitario: item.preco_unitario,
    status_item: 'PENDENTE',
  }))

  const { error: iErr } = await supabase
    .from('transferencia_item')
    .insert(itens)

  if (iErr) {
    return { error: 'Transferência criada, mas erro nos itens: ' + iErr.message }
  }

  revalidatePath('/dashboard/transferencias')
  return { success: true, codigo, transferencia_id: transferencia.id }
}

type UnidadeInfo = { id: string; nome: string }
type GetUnidadeResult =
  | { success: true; unidade: UnidadeInfo }
  | { success: false; error: string }

export async function getUserUnidadeAction(): Promise<GetUnidadeResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.id) {
    return { success: false, error: 'Usuário não autenticado' }
  }

  const { data, error } = await supabase
    .rpc('fn_get_user_unidade', { p_user_id: user.id })

  if (error || !data) {
    return { success: false, error: 'Vínculo com unidade não encontrado' }
  }

  const unidade = data as UnidadeInfo

  return {
    success: true,
    unidade,
  }
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

  // Valida ownership + permissão ANTES de chamar a RPC (SECURITY DEFINER ignora RLS).
  const { data: vinculos } = await supabase
    .from('usuario_empresa')
    .select('empresa_id')
    .eq('user_id', user.id)
  const empresaIds = (vinculos ?? []).map((v: { empresa_id: string }) => v.empresa_id)
  if (empresaIds.length === 0) return { error: 'Empresa não encontrada' }

  const { data: transf } = await supabase
    .from('transferencia')
    .select('empresa_id, unidade_destino_id')
    .eq('id', data.transferencia_id)
    .maybeSingle()
  if (!transf) return { error: 'Transferência não encontrada' }
  if (!empresaIds.includes(transf.empresa_id)) {
    return { error: 'Sem permissão para confirmar esta transferência' }
  }

  // RBAC: admin global, ou permissão de escrita em 'receber'/'transferencias'
  // para a unidade de destino (ou para todas as unidades, unidade_id = null).
  const { data: perms } = await supabase
    .from('permissao')
    .select('tela, acesso, unidade_id')
    .eq('usuario_id', user.id)
  const lista = (perms ?? []) as { tela: string; acesso: string; unidade_id: string | null }[]
  const isAdminGlobal = lista.some(
    (p) => p.tela === '*' && p.acesso === 'admin' && p.unidade_id === null
  )
  if (!isAdminGlobal) {
    const podeReceber = lista.some(
      (p) =>
        (p.tela === 'receber' || p.tela === 'transferencias') &&
        (p.acesso === 'escrita' || p.acesso === 'admin') &&
        (p.unidade_id === null || p.unidade_id === transf.unidade_destino_id)
    )
    if (!podeReceber) {
      return { error: 'Você não tem permissão para confirmar recebimento nesta unidade' }
    }
  }

  // Executa toda a confirmação em uma única transação no banco:
  // atualiza transferencia_item, insumo_saldo, insumo_saldo_historico e transferencia.
  const { data: result, error } = await supabase.rpc('confirmar_recebimento', {
    p_transferencia_id: data.transferencia_id,
    p_usuario_id:       user.id,
    p_itens:            data.itens,
  })

  if (error) return { error: 'Erro ao confirmar recebimento: ' + error.message }

  const rpcResult = result as { error?: string; success?: boolean } | null
  if (rpcResult?.error) return { error: rpcResult.error }

  revalidatePath('/dashboard/transferencias')
  revalidatePath(`/dashboard/transferencias/${data.transferencia_id}`)
  return { success: true }
}

export async function cancelarTransferenciaAction(transferenciaId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  // Busca transferência e valida empresa + status
  const { data: ue } = await supabase
    .from('usuario_empresa').select('empresa_id').eq('user_id', user.id).maybeSingle()
  if (!ue) return { error: 'Empresa não encontrada' }

  const { data: t } = await supabase
    .from('transferencia').select('status, empresa_id').eq('id', transferenciaId).maybeSingle()

  if (!t) return { error: 'Transferência não encontrada' }
  if (t.empresa_id !== ue.empresa_id) return { error: 'Sem permissão' }
  if (!['PENDENTE', 'EM_TRANSITO'].includes(t.status)) {
    return { error: 'Só é possível cancelar transferências pendentes ou em trânsito' }
  }

  const { error } = await supabase
    .from('transferencia')
    .update({ status: 'CANCELADA' })
    .eq('id', transferenciaId)

  if (error) return { error: 'Erro ao cancelar: ' + error.message }

  revalidatePath('/dashboard/transferencias')
  revalidatePath(`/dashboard/transferencias/${transferenciaId}`)
  return { success: true }
}

export async function excluirTransferenciaAction(transferenciaId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { data: ue } = await supabase
    .from('usuario_empresa').select('empresa_id').eq('user_id', user.id).maybeSingle()
  if (!ue) return { error: 'Empresa não encontrada' }

  const { data: t } = await supabase
    .from('transferencia').select('status, empresa_id').eq('id', transferenciaId).maybeSingle()

  if (!t) return { error: 'Transferência não encontrada' }
  if (t.empresa_id !== ue.empresa_id) return { error: 'Sem permissão' }
  if (!['PENDENTE', 'CANCELADA'].includes(t.status)) {
    return { error: 'Só é possível excluir transferências pendentes ou canceladas' }
  }

  // Itens primeiro (FK)
  await supabase.from('transferencia_item').delete().eq('transferencia_id', transferenciaId)

  const { error } = await supabase.from('transferencia').delete().eq('id', transferenciaId)
  if (error) return { error: 'Erro ao excluir: ' + error.message }

  revalidatePath('/dashboard/transferencias')
  return { success: true }
}
