// Informações oficiais da loja (horários, endereço, pagamento, entrega)
// que entram no prompt do robô. Editadas na aba "Robô" do painel.
// Roda no webhook → supabaseAdmin.

import { supabaseAdmin } from '@/lib/supabase/admin'
import { formatarInfoLoja, type InfoLoja } from './info-texto'

/** Bloco pronto para o prompt, ou null se a loja não preencheu nada. */
export async function buscarInfoLoja(unidadeId: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin
      .from('atendimento_loja_info')
      .select('horarios, endereco, pagamento, entrega, extra')
      .eq('unidade_id', unidadeId)
      .maybeSingle()
    return formatarInfoLoja((data as InfoLoja | null) ?? null)
  } catch (erro) {
    console.error('Erro ao buscar info da loja (seguindo sem ela):', erro)
    return null
  }
}
