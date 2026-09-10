'use server'

import { createClient } from '@/lib/supabase/server'
import { temAcesso } from '@/app/lib/authz'
import { revalidatePath } from 'next/cache'
import { getEmpresaId } from '@/app/lib/escopo'

type GetResult<T> = { error?: string; data?: T }
type SaveResult = { error?: string; success?: boolean }


export async function getConfigAction<T = unknown>(
  chave: string
): Promise<GetResult<T>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const empresaId = await getEmpresaId(user.id, supabase)
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

// Whitelist: a action era um upsert de chave LIVRE — quem tinha 'cadastros'
// sobrescrevia qualquer config da empresa. Só as chaves que a UI realmente edita.
const CHAVES_CONFIG = new Set([
  'categorias_insumo',
  'tipos_receita',
  'unidades_medida',
  'locais_producao',   // LOCAIS_CONFIG_KEY (app/lib/locais.ts)
  'rodape_impressao',  // RODAPE_CONFIG_KEY (documento-impressao.tsx)
])

export async function saveConfigAction(
  chave: string,
  valor: unknown
): Promise<SaveResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!(await temAcesso(user.id, ['cadastros']))) return { error: 'Sem permissão para editar cadastros' }
  if (!CHAVES_CONFIG.has(chave)) return { error: `Configuração desconhecida: ${chave}` }

  const empresaId = await getEmpresaId(user.id, supabase)
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
