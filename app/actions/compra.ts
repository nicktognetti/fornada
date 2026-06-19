'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult, Compra, NovaCompraInput } from '@/app/dashboard/transferencias/receber/types'

export async function criarCompraAction(input: NovaCompraInput): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  if (!input.fornecedor.trim()) return { error: 'Fornecedor obrigatório' }
  if (!input.data_compra)       return { error: 'Data obrigatória' }
  if (input.valor_total <= 0)   return { error: 'Valor deve ser maior que zero' }

  const { error } = await supabase.from('compra').insert({
    unidade_id:  input.unidade_id,
    fornecedor:  input.fornecedor.trim(),
    data_compra: input.data_compra,
    valor_total: input.valor_total,
    observacao:  input.observacao?.trim() || null,
  })

  if (error) return { error: 'Erro ao registrar compra: ' + error.message }

  revalidatePath('/dashboard/transferencias/receber')
  return { success: true }
}

export async function listarComprasAction(unidadeId: string): Promise<Compra[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('compra')
    .select('*')
    .eq('unidade_id', unidadeId)
    .order('data_compra', { ascending: false })
    .limit(50)

  return (data ?? []) as Compra[]
}
