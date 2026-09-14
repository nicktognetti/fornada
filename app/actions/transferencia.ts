'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
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
  itens: Array<{ produto_id: string; quantidade_enviada: number }>
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

  // Busca preços da unidade de origem para registro financeiro (transparente ao operador)
  const prodIds = data.itens.map((i) => i.produto_id)
  const { data: precos } = await supabase
    .from('produto_preco')
    .select('produto_id, preco_praticado')
    .in('produto_id', prodIds)
    .eq('unidade_id', data.unidade_origem_id)

  const precoMap = new Map<string, number>()
  for (const p of precos ?? []) precoMap.set(p.produto_id, p.preco_praticado)

  // Uma transação só: código + cabeçalho + itens. Antes eram 3 chamadas e a
  // falha na última deixava um cabeçalho EM_TRANSITO sem itens; o re-clique
  // criava uma segunda transferência. O código só é gerado dentro da função,
  // depois das validações, e o valor_total é calculado lá a partir dos itens.
  const { data: res, error: eRpc } = await supabase.rpc('criar_transferencia_com_itens', {
    p_empresa_id: data.empresa_id,
    p_unidade_origem_id: data.unidade_origem_id,
    p_unidade_destino_id: data.unidade_destino_id,
    p_tipo: data.tipo,
    p_observacao: data.observacao?.trim() || null,
    p_itens: data.itens.map((item) => ({
      produto_id: item.produto_id,
      quantidade_enviada: item.quantidade_enviada,
      preco_unitario: precoMap.get(item.produto_id) ?? 0,
    })),
  })
  if (eRpc) return { error: 'Erro ao criar transferência: ' + eRpc.message }

  const rpc = res as { error?: string; success?: boolean; id?: string; codigo?: string } | null
  if (rpc?.error) return { error: rpc.error }
  if (!rpc?.success || !rpc.id || !rpc.codigo) {
    return { error: 'Erro ao criar transferência: resposta inesperada do banco' }
  }

  revalidatePath('/dashboard/transferencias')
  return { success: true, codigo: rpc.codigo, transferencia_id: rpc.id }
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

// ── Itens de uma transferência com nomes de produtos ────────────────────────
// Usa supabaseAdmin para contornar RLS de produto por loja
// (o destinatário precisa ver nomes de produtos originados em outra loja)

export type ItemTransferencia = {
  id: string
  produto_nome: string
  quantidade_enviada: number
  preco_unitario: number
}

export async function getTransferenciaItensAction(
  transferenciaId: string
): Promise<{ data?: ItemTransferencia[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  // Só checava login: com o UUID em mãos, qualquer autenticado (de qualquer
  // empresa) lia itens, quantidades e preços de qualquer transferência.
  // O service role abaixo é para ver o NOME de produto da outra loja — não
  // para dispensar a checagem de posse.
  const { data: vinculos } = await supabase
    .from('usuario_empresa')
    .select('empresa_id')
    .eq('user_id', user.id)
  const empresaIds = (vinculos ?? []).map((v: { empresa_id: string }) => v.empresa_id)
  if (empresaIds.length === 0) return { error: 'Empresa não encontrada' }

  const { data: transf } = await supabaseAdmin
    .from('transferencia')
    .select('empresa_id')
    .eq('id', transferenciaId)
    .maybeSingle()
  if (!transf || !empresaIds.includes(transf.empresa_id as string))
    return { error: 'Transferência não encontrada' }

  const { data: itensRaw, error: itensErr } = await supabaseAdmin
    .from('transferencia_item')
    .select('id, produto_id, quantidade_enviada, preco_unitario')
    .eq('transferencia_id', transferenciaId)

  if (itensErr) return { error: itensErr.message }

  const prodIds = (itensRaw ?? []).map((i: { produto_id: string }) => i.produto_id)
  const { data: produtos } = prodIds.length > 0
    ? await supabaseAdmin.from('produto').select('id, nome').in('id', prodIds)
    : { data: [] }

  const prodMap = new Map(
    ((produtos ?? []) as { id: string; nome: string }[]).map((p) => [p.id, p.nome])
  )

  return {
    data: (itensRaw ?? []).map((i: {
      id: string; produto_id: string; quantidade_enviada: number; preco_unitario: number
    }) => ({
      id: i.id,
      produto_nome: prodMap.get(i.produto_id) ?? '—',
      quantidade_enviada: i.quantidade_enviada,
      preco_unitario: i.preco_unitario,
    })),
  }
}
