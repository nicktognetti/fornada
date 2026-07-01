import type { createClient } from '@/lib/supabase/server'

/** Alimenta o cadastro de clientes (autocomplete). Insere se novo na loja; não sobrescreve. */
export async function upsertCliente(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string, unidadeId: string, nome: string, telefone?: string | null,
): Promise<void> {
  if (!nome.trim()) return
  await supabase.from('cliente').upsert(
    { empresa_id: empresaId, unidade_id: unidadeId, nome: nome.trim(), telefone: telefone?.trim() || null },
    { onConflict: 'unidade_id,nome', ignoreDuplicates: true },
  )
}
