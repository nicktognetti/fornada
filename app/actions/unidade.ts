'use server'

import { createClient } from '@/lib/supabase/server'

export interface UnidadeOption {
  id: string
  nome: string
}

export async function getUserUnidadesAction(): Promise<UnidadeOption[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Busca vínculos do usuário no schema fornada
  const { data: vinculos } = await supabase
    .schema('fornada')
    .from('usuario_unidade')
    .select('unidade_id')
    .eq('user_id', user.id)
    .order('created_at')

  if (!vinculos || vinculos.length === 0) return []

  const ids = vinculos.map((v) => v.unidade_id)

  const { data: unidades } = await supabase
    .from('unidade')
    .select('id, nome')
    .in('id', ids)
    .order('nome')

  return (unidades ?? []) as UnidadeOption[]
}
