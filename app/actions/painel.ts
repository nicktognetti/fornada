'use server'

import { createClient } from '@/lib/supabase/server'
import { temAcesso } from '@/app/lib/authz'
import { revalidatePath } from 'next/cache'
import { getReceitaComposicao, type ReceitaComposicao } from '@/app/dashboard/receitas/composicao'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProdutoFinanceiro = {
  produto_id: string
  produto_nome: string
  produto_tipo: 'produzido' | 'revenda'
  categoria: string | null
  empresa_id: string
  unidade_id: string | null
  unidade_nome: string | null
  custo_total: number
  preco_venda: number
  margem_rs: number
  margem_percentual: number
  markup_percentual: number
}

export type PainelIndicadores = {
  total_produtos: number
  produtos_com_preco: number
  produtos_sem_preco: number
  produtos_margem_negativa: number
  margem_media_percentual: number
  /** Margem média ponderada pelo valor do portfólio: SOMA((pv-ct)*pv) / SOMA(pv) */
  margem_ponderada_percentual: number
  /** Soma dos preços de venda do portfólio. NÃO é faturamento real (depende do volume vendido). */
  valor_portfolio: number
  custo_total_geral: number
  margem_total_rs: number
}

// ── Despesas Fixas ────────────────────────────────────────────────────────────

export type DespesaFixa = {
  id: string
  empresa_id: string
  descricao: string
  valor: number
  created_at: string
  updated_at: string
}

// Mantém compatibilidade com componentes que ainda usam FichaFinanceira
export type FichaFinanceira = ProdutoFinanceiro

export type ProdutoDetalhe = {
  produto_id: string
  nome: string
  tipo: 'produzido' | 'revenda'
  categoria: string | null
  unidade_nome: string | null
  receita_id: string | null
  custo_compra: number | null
  custo_embalagem: number
  custo_total: number
  preco: number
  volume_mensal: number
  margem_rs: number
  margem_percentual: number
  markup_percentual: number
  /** Composição de custo da ficha (só para produtos produzidos com receita). */
  composicao: ReceitaComposicao | null
}

type ActionResult<T = void> = T extends void
  ? { error?: string; success?: boolean }
  : { error?: string; data?: T }

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── getPainelFinanceiro ───────────────────────────────────────────────────────

export type PainelSort = {
  column: 'produto_nome' | 'custo_total' | 'preco_venda' | 'margem_percentual' | 'markup_percentual'
  direction: 'asc' | 'desc'
}

export async function getPainelFinanceiro(
  unidadeId?: string,
  tipoProduto?: 'produzido' | 'revenda' | 'todos',
  pagination?: { page: number; pageSize: number },
  sort?: PainelSort,
): Promise<ActionResult<{ fichas: ProdutoFinanceiro[]; indicadores: PainelIndicadores; total: number }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const empresaId = await getEmpresaId(supabase, user.id)
  if (!empresaId) return { error: 'Empresa não encontrada' }

  const sortCol = sort?.column ?? 'produto_nome'
  const sortAsc = sort ? sort.direction === 'asc' : true

  let q = supabase
    .from('vw_produto_financeiro')
    .select('produto_id,produto_nome,produto_tipo,categoria,empresa_id,unidade_id,unidade_nome,custo_total,preco_venda,margem_rs,margem_percentual,markup_percentual', { count: 'exact' })
    .eq('empresa_id', empresaId)
    .order(sortCol, { ascending: sortAsc })

  if (unidadeId) q = q.eq('unidade_id', unidadeId)
  if (tipoProduto && tipoProduto !== 'todos') q = q.eq('produto_tipo', tipoProduto)

  if (pagination) {
    const { page, pageSize } = pagination
    q = q.range(page * pageSize, (page + 1) * pageSize - 1)
  }

  const { data, error, count } = await q
  if (error) return { error: error.message }

  type Row = {
    produto_id: string; produto_nome: string; produto_tipo: string
    categoria: string | null; empresa_id: string; unidade_id: string | null
    unidade_nome: string | null; custo_total: string; preco_venda: string
    margem_rs: string; margem_percentual: string; markup_percentual: string
  }

  const fichas: ProdutoFinanceiro[] = ((data as Row[]) ?? []).map((r) => ({
    produto_id:        r.produto_id,
    produto_nome:      r.produto_nome,
    produto_tipo:      r.produto_tipo as 'produzido' | 'revenda',
    categoria:         r.categoria,
    empresa_id:        r.empresa_id,
    unidade_id:        r.unidade_id,
    unidade_nome:      r.unidade_nome,
    custo_total:       Number(r.custo_total),
    preco_venda:       Number(r.preco_venda),
    margem_rs:         Number(r.margem_rs),
    margem_percentual: Number(r.margem_percentual),
    markup_percentual: Number(r.markup_percentual),
    // compatibilidade FichaFinanceira
    receita_id:        r.produto_id,
    receita_nome:      r.produto_nome,
    rendimento:        1,
    rendimento_unidade: 'un',
  } as ProdutoFinanceiro))

  const comPreco = fichas.filter((f) => f.preco_venda > 0)
  const somaPrecos = comPreco.reduce((s, f) => s + f.preco_venda, 0)
  // Margem ponderada: SOMA((pv - ct) * pv) / SOMA(pv)
  const margemPonderada = somaPrecos > 0
    ? comPreco.reduce((s, f) => s + (f.preco_venda - f.custo_total) * f.preco_venda, 0) / somaPrecos
    : 0
  const indicadores: PainelIndicadores = {
    total_produtos:              fichas.length,
    produtos_com_preco:          comPreco.length,
    produtos_sem_preco:          fichas.length - comPreco.length,
    produtos_margem_negativa:    comPreco.filter((f) => f.margem_percentual < 0).length,
    margem_media_percentual:     comPreco.length
      ? comPreco.reduce((s, f) => s + f.margem_percentual, 0) / comPreco.length
      : 0,
    margem_ponderada_percentual: margemPonderada,
    valor_portfolio:             somaPrecos,
    custo_total_geral:           fichas.reduce((s, f) => s + f.custo_total, 0),
    margem_total_rs:             comPreco.reduce((s, f) => s + f.margem_rs, 0),
  }

  return { data: { fichas, indicadores, total: count ?? fichas.length } }
}

// ── savePrecoVenda ────────────────────────────────────────────────────────────

export async function savePrecoVenda(
  produtoId: string,
  precoVenda: number,
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (precoVenda <= 0) return { error: 'Preço deve ser maior que zero' }

  const empresaId = await getEmpresaId(supabase, user.id)
  if (!empresaId) return { error: 'Empresa não encontrada' }

  // Busca unidade_id + verifica ownership de empresa
  const { data: prod } = await supabase
    .from('produto')
    .select('unidade_id, empresa_id')
    .eq('id', produtoId)
    .single()

  if (!prod) return { error: 'Produto não encontrado' }
  if (prod.empresa_id !== empresaId) return { error: 'Acesso negado' }
  if (!prod.unidade_id) return { error: 'Produto sem unidade definida' }

  // Permissão de preços/painel/produtos NA LOJA do produto
  if (!(await temAcesso(user.id, ['painel', 'precos', 'produtos'], { unidadeId: prod.unidade_id })))
    return { error: 'Sem permissão para alterar preços nesta unidade' }

  const { error } = await supabase
    .from('produto_preco')
    .upsert(
      { produto_id: produtoId, unidade_id: prod.unidade_id, preco_praticado: precoVenda, volume_mensal: 0 },
      { onConflict: 'produto_id,unidade_id' }
    )

  if (error) return { error: error.message }

  revalidatePath('/dashboard/painel')
  revalidatePath('/dashboard/precos')
  revalidatePath('/dashboard/produtos')
  return { success: true }
}

// ── savePrecoVendaLote ────────────────────────────────────────────────────────

export async function savePrecoVendaLote(
  items: { id: string; preco: number }[],
): Promise<ActionResult<{ salvos: number; erros: number }>> {
  if (items.length === 0) return { data: { salvos: 0, erros: 0 } }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const empresaId = await getEmpresaId(supabase, user.id)
  if (!empresaId) return { error: 'Empresa não encontrada' }

  // Busca unidade_id + empresa_id de todos os produtos em batch
  const ids = items.map((i) => i.id)
  const { data: produtos, error: errProd } = await supabase
    .from('produto')
    .select('id, unidade_id, empresa_id')
    .in('id', ids)

  if (errProd) return { error: errProd.message }

  const prodMap = new Map(
    (produtos ?? []).map((p: { id: string; unidade_id: string | null; empresa_id: string }) =>
      [p.id, p]
    )
  )

  // Quais lojas presentes no lote o usuário pode precificar (checa 1× por loja)
  const unidadesLote = [...new Set(
    (produtos ?? []).map((p) => p.unidade_id).filter((u): u is string => !!u)
  )]
  const unidadesPermitidas = new Set<string>()
  for (const uid of unidadesLote) {
    if (await temAcesso(user.id, ['painel', 'precos', 'produtos'], { unidadeId: uid })) {
      unidadesPermitidas.add(uid)
    }
  }

  const upserts: { produto_id: string; unidade_id: string; preco_praticado: number; volume_mensal: number }[] = []
  let erros = 0

  for (const item of items) {
    if (item.preco <= 0) { erros++; continue }
    const prod = prodMap.get(item.id)
    if (!prod || prod.empresa_id !== empresaId || !prod.unidade_id) { erros++; continue }
    if (!unidadesPermitidas.has(prod.unidade_id)) { erros++; continue }
    upserts.push({
      produto_id: item.id,
      unidade_id: prod.unidade_id,
      preco_praticado: item.preco,
      volume_mensal: 0,
    })
  }

  if (upserts.length === 0) return { data: { salvos: 0, erros } }

  const { error } = await supabase
    .from('produto_preco')
    .upsert(upserts, { onConflict: 'produto_id,unidade_id' })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/painel')
  revalidatePath('/dashboard/precos')
  revalidatePath('/dashboard/produtos')
  return { data: { salvos: upserts.length, erros } }
}

// ── getProdutos ───────────────────────────────────────────────────────────────

export async function getProdutos(opts?: {
  unidadeId?: string
  semPreco?: boolean
  tipo?: 'produzido' | 'revenda'
}): Promise<ActionResult<ProdutoFinanceiro[]>> {
  return getPainelFinanceiro(opts?.unidadeId, opts?.tipo).then((r) => ({
    error: r.error,
    data: opts?.semPreco
      ? (r.data?.fichas ?? []).filter((f) => f.preco_venda === 0)
      : r.data?.fichas,
  }))
}

// ── getProdutoDetalhe ─────────────────────────────────────────────────────────

export async function getProdutoDetalhe(
  produtoId: string,
): Promise<ActionResult<ProdutoDetalhe>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const [prodRes, finRes, precoRes] = await Promise.all([
    supabase
      .from('produto')
      .select('id, nome, tipo, categoria, receita_id, custo_compra, custo_embalagem')
      .eq('id', produtoId)
      .maybeSingle(),
    supabase
      .from('vw_produto_financeiro')
      .select('custo_total, preco_venda, margem_rs, margem_percentual, markup_percentual, unidade_nome')
      .eq('produto_id', produtoId)
      .maybeSingle(),
    supabase
      .from('produto_preco')
      .select('preco_praticado, volume_mensal')
      .eq('produto_id', produtoId)
      .maybeSingle(),
  ])

  const prod = prodRes.data as {
    id: string; nome: string; tipo: 'produzido' | 'revenda'; categoria: string | null
    receita_id: string | null; custo_compra: number | null; custo_embalagem: number | null
  } | null
  if (!prod) return { error: 'Produto não encontrado' }

  const fin = finRes.data as {
    custo_total: number | null; preco_venda: number | null; margem_rs: number | null
    margem_percentual: number | null; markup_percentual: number | null; unidade_nome: string | null
  } | null

  const composicao =
    prod.tipo === 'produzido' && prod.receita_id
      ? await getReceitaComposicao(prod.receita_id)
      : null

  return {
    data: {
      produto_id: prod.id,
      nome: prod.nome,
      tipo: prod.tipo,
      categoria: prod.categoria,
      unidade_nome: fin?.unidade_nome ?? null,
      receita_id: prod.receita_id,
      custo_compra: prod.custo_compra,
      custo_embalagem: prod.custo_embalagem ?? 0,
      custo_total: fin?.custo_total ?? 0,
      preco: fin?.preco_venda ?? 0,
      volume_mensal: precoRes.data?.volume_mensal ?? 0,
      margem_rs: fin?.margem_rs ?? 0,
      margem_percentual: fin?.margem_percentual ?? 0,
      markup_percentual: fin?.markup_percentual ?? 0,
      composicao,
    },
  }
}

// ── createProdutoRevenda ──────────────────────────────────────────────────────

export async function createProdutoRevenda(
  nome: string,
  categoria: string | null,
  custoCompra: number,
  unidadeId: string,
  local?: string | null,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!(await temAcesso(user.id, ['painel', 'precos', 'produtos'], { unidadeId })))
    return { error: 'Sem permissão para criar produtos nesta unidade' }

  const empresaId = await getEmpresaId(supabase, user.id)
  if (!empresaId) return { error: 'Empresa não encontrada' }

  const { data, error } = await supabase
    .from('produto')
    .insert({
      nome,
      tipo: 'revenda',
      categoria,
      custo_compra: custoCompra,
      local: local?.trim() || null,
      empresa_id: empresaId,
      unidade_id: unidadeId,
      ativo: true,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/dashboard/produtos')
  revalidatePath('/dashboard/painel')
  return { data: { id: data.id } }
}

// ── createProdutoFabricado ────────────────────────────────────────────────────
// Cria um produto do tipo 'produzido' ligado a uma ficha técnica (receita).
// O custo vem automaticamente do custo unitário da ficha (vw_produto_financeiro).
export async function createProdutoFabricado(
  nome: string,
  categoria: string | null,
  receitaId: string,
  unidadeId: string,
  local?: string | null,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!nome.trim()) return { error: 'Informe o nome do produto' }
  if (!receitaId) return { error: 'Selecione uma ficha técnica' }
  if (!(await temAcesso(user.id, ['painel', 'precos', 'produtos'], { unidadeId })))
    return { error: 'Sem permissão para criar produtos nesta unidade' }

  const empresaId = await getEmpresaId(supabase, user.id)
  if (!empresaId) return { error: 'Empresa não encontrada' }

  // A ficha precisa existir na empresa (RLS já restringe às unidades do usuário).
  const { data: receita } = await supabase
    .from('receita')
    .select('id, empresa_id')
    .eq('id', receitaId)
    .maybeSingle()
  if (!receita || receita.empresa_id !== empresaId) return { error: 'Ficha técnica não encontrada' }

  // Evita dois produtos apontando pra mesma ficha na mesma unidade.
  const { data: jaExiste } = await supabase
    .from('produto')
    .select('id')
    .eq('receita_id', receitaId)
    .eq('unidade_id', unidadeId)
    .eq('ativo', true)
    .maybeSingle()
  if (jaExiste) return { error: 'Já existe um produto ligado a essa ficha nesta loja' }

  const { data, error } = await supabase
    .from('produto')
    .insert({
      nome: nome.trim(),
      tipo: 'produzido',
      categoria,
      receita_id: receitaId,
      local: local?.trim() || null,
      empresa_id: empresaId,
      unidade_id: unidadeId,
      ativo: true,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/dashboard/produtos')
  revalidatePath('/dashboard/painel')
  return { data: { id: data.id } }
}

// ── setProdutoLocal ───────────────────────────────────────────────────────────
// Define o setor de produção do produto (Produção, Confeitaria, Cozinha…).
export async function setProdutoLocal(produtoId: string, local: string | null): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!(await temAcesso(user.id, ['produtos']))) return { error: 'Sem permissão' }

  const { error } = await supabase.from('produto').update({ local: local?.trim() || null }).eq('id', produtoId)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/produtos')
  return { success: true }
}

// ── linkProdutoReceita ────────────────────────────────────────────────────────

export async function linkProdutoReceita(
  produtoId: string,
  receitaId: string,
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase
    .from('produto')
    .update({ receita_id: receitaId, tipo: 'produzido' })
    .eq('id', produtoId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/produtos')
  revalidatePath('/dashboard/painel')
  return { success: true }
}

// ── aplicarPrecoAction (compat legado) ────────────────────────────────────────

export async function aplicarPrecoAction(
  produtoId: string,
  novoPreco: number,
): Promise<ActionResult> {
  return savePrecoVenda(produtoId, novoPreco)
}

// ── getDespesasFixas ──────────────────────────────────────────────────────────

export async function getDespesasFixas(): Promise<ActionResult<DespesaFixa[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const empresaId = await getEmpresaId(supabase, user.id)
  if (!empresaId) return { error: 'Empresa não encontrada' }

  const { data, error } = await supabase
    .from('despesa_fixa_empresa')
    .select('id, empresa_id, descricao, valor, created_at, updated_at')
    .eq('empresa_id', empresaId)
    .order('descricao')

  if (error) return { error: error.message }
  return { data: (data ?? []) as DespesaFixa[] }
}

// ── saveDespesaFixa ───────────────────────────────────────────────────────────

export async function saveDespesaFixa(
  descricao: string,
  valor: number,
  id?: string,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!(await temAcesso(user.id, ['painel']))) return { error: 'Sem permissão para editar despesas' }
  if (!descricao.trim()) return { error: 'Descrição obrigatória' }
  if (valor <= 0) return { error: 'Valor deve ser maior que zero' }

  const empresaId = await getEmpresaId(supabase, user.id)
  if (!empresaId) return { error: 'Empresa não encontrada' }

  if (id) {
    // Update — verifica ownership via RLS
    const { error } = await supabase
      .from('despesa_fixa_empresa')
      .update({ descricao: descricao.trim(), valor })
      .eq('id', id)
      .eq('empresa_id', empresaId)
    if (error) return { error: error.message }
    revalidatePath('/dashboard/painel')
    return { data: { id } }
  }

  const { data, error } = await supabase
    .from('despesa_fixa_empresa')
    .insert({ empresa_id: empresaId, descricao: descricao.trim(), valor })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/dashboard/painel')
  return { data: { id: data.id } }
}

// ── deleteDespesaFixa ─────────────────────────────────────────────────────────

export async function deleteDespesaFixa(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!(await temAcesso(user.id, ['painel']))) return { error: 'Sem permissão para editar despesas' }

  const empresaId = await getEmpresaId(supabase, user.id)
  if (!empresaId) return { error: 'Empresa não encontrada' }

  const { error } = await supabase
    .from('despesa_fixa_empresa')
    .delete()
    .eq('id', id)
    .eq('empresa_id', empresaId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/painel')
  return { success: true }
}
