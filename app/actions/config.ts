'use server'

import { createClient } from '@/lib/supabase/server'
import { temAcesso } from '@/app/lib/authz'
import { revalidatePath } from 'next/cache'

type GetResult<T> = { error?: string; data?: T }
type SaveResult = { error?: string; success?: boolean }

async function getEmpresaId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('usuario_empresa')
    .select('empresa_id')
    .eq('user_id', userId)
    .single()
  return data?.empresa_id ?? null
}

export async function getConfigAction<T = unknown>(
  chave: string
): Promise<GetResult<T>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const empresaId = await getEmpresaId(supabase, user.id)
  if (!empresaId) return { error: 'Empresa não encontrada' }

  const { data, error } = await supabase
    .from('config_geral')
    .select('valor')
    .eq('empresa_id', empresaId)
    .eq('chave', chave)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return { data: undefined }
    return { error: error.message }
  }

  return { data: data.valor as T }
}

export async function saveConfigAction(
  chave: string,
  valor: unknown
): Promise<SaveResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!(await temAcesso(user.id, ['cadastros']))) return { error: 'Sem permissão para editar cadastros' }

  const empresaId = await getEmpresaId(supabase, user.id)
  if (!empresaId) return { error: 'Empresa não encontrada' }

  const { error } = await supabase
    .from('config_geral')
    .upsert(
      { empresa_id: empresaId, chave, valor },
      { onConflict: 'empresa_id,chave' }
    )

  if (error) return { error: error.message }

  revalidatePath('/dashboard/cadastros')
  return { success: true }
}
