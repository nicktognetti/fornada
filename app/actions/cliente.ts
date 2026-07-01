'use server'

import { createClient } from '@/lib/supabase/server'
import { getUnidadePreferida } from '@/app/actions/unidade'

export type ClienteAutocomplete = { nome: string; contato: string | null }

/** Clientes da unidade atual, para autocomplete no builder de orçamento/encomenda. */
export async function getClientes(): Promise<ClienteAutocomplete[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const unidadeId = await getUnidadePreferida()
  let q = supabase.from('cliente').select('nome, contato').order('nome')
  if (unidadeId) q = q.eq('unidade_id', unidadeId)
  const { data } = await q
  return (data as ClienteAutocomplete[]) ?? []
}
