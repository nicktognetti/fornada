'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const COOKIE_EMPRESA = 'empresa_preferida'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export interface EmpresaOption {
  id: string
  slug: string
  nome: string
}

// ── Empresas do usuário ───────────────────────────────────────────────────────

export async function getEmpresasDoUsuario(): Promise<EmpresaOption[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: vinculos } = await supabase
    .from('usuario_empresa')
    .select('empresa_id')
    .eq('user_id', user.id)

  if (!vinculos || vinculos.length === 0) return []

  const ids = vinculos.map((v: { empresa_id: string }) => v.empresa_id)

  const { data: empresas } = await supabase
    .from('empresa')
    .select('id, slug, nome')
    .in('id', ids)
    .eq('ativa', true)
    .order('nome')

  return (empresas ?? []) as EmpresaOption[]
}

export async function getEmpresaAtualId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Cookie primeiro
  const jar = await cookies()
  const cookieVal = jar.get(COOKIE_EMPRESA)?.value ?? null

  if (cookieVal) {
    // Valida que o usuário ainda tem acesso a essa empresa
    const { data } = await supabase
      .from('usuario_empresa')
      .select('empresa_id')
      .eq('user_id', user.id)
      .eq('empresa_id', cookieVal)
      .maybeSingle()
    if (data) return cookieVal
  }

  // Fallback: primeira empresa do usuário
  const { data: vinculo } = await supabase
    .from('usuario_empresa')
    .select('empresa_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  return vinculo?.empresa_id ?? null
}

// ── Cookie ────────────────────────────────────────────────────────────────────

export async function setEmpresaCookieAction(empresaId: string | null): Promise<void> {
  const jar = await cookies()
  if (empresaId) {
    jar.set(COOKIE_EMPRESA, empresaId, {
      maxAge: COOKIE_MAX_AGE,
      path: '/',
      sameSite: 'lax',
    })
  } else {
    jar.delete(COOKIE_EMPRESA)
  }
}

// ── Meta de faturamento ───────────────────────────────────────────────────────

export type MetaFaturamento = {
  mesAno: string
  valorCalculado: number
  valorManual: number | null
  valorEfetivo: number
  /** Soma dos preços praticados do portfólio da empresa (não representa faturamento real) */
  valorPortfolio: number
  /** @deprecated use valorPortfolio */
  faturamentoAtual: number
  percentual: number
  diasRestantes: number
}

export async function getMetaFaturamento(): Promise<MetaFaturamento | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const empresaId = await getEmpresaAtualId()
  if (!empresaId) return null

  const hoje = new Date()
  const mesAno = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`

  // Valor do portfólio = soma dos preços praticados filtrados por empresa_id no SQL
  const { data: precos } = await supabase
    .from('produto_preco')
    .select('preco_praticado, produto!inner(empresa_id)')
    .eq('produto.empresa_id', empresaId)
    .gt('preco_praticado', 0)

  const valorPortfolio = ((precos ?? []) as { preco_praticado: number }[])
    .reduce((s, p) => s + p.preco_praticado, 0)

  // Meta manual para o mês atual
  const { data: metaRow } = await supabase
    .from('meta_faturamento')
    .select('valor_manual')
    .eq('empresa_id', empresaId)
    .eq('mes_ano', mesAno)
    .maybeSingle()

  const valorManual: number | null = metaRow?.valor_manual ?? null

  // Meta automática: portfólio × 1.2 (mínimo 1000)
  const valorCalculado = Math.max(valorPortfolio * 1.2, 1000)
  const valorEfetivo = valorManual ?? valorCalculado

  const percentual = valorEfetivo > 0 ? Math.min((valorPortfolio / valorEfetivo) * 100, 100) : 0

  // Dias restantes no mês
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()
  const diasRestantes = ultimoDia - hoje.getDate()

  return {
    mesAno,
    valorCalculado,
    valorManual,
    valorEfetivo,
    valorPortfolio,
    faturamentoAtual: valorPortfolio,
    percentual,
    diasRestantes,
  }
}

export async function salvarMetaManual(valor: number): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const empresaId = await getEmpresaAtualId()
  if (!empresaId) return { error: 'Empresa não encontrada' }

  const hoje = new Date()
  const mesAno = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`

  const { error } = await supabase
    .from('meta_faturamento')
    .upsert(
      { empresa_id: empresaId, mes_ano: mesAno, valor_manual: valor, usuario_id: user.id },
      { onConflict: 'empresa_id,mes_ano' }
    )

  if (error) return { error: error.message }

  revalidatePath('/dashboard/painel')
  return { success: true }
}

export async function limparMetaManual(): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const empresaId = await getEmpresaAtualId()
  if (!empresaId) return { error: 'Empresa não encontrada' }

  const hoje = new Date()
  const mesAno = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`

  const { error } = await supabase
    .from('meta_faturamento')
    .update({ valor_manual: null })
    .eq('empresa_id', empresaId)
    .eq('mes_ano', mesAno)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/painel')
  return { success: true }
}
