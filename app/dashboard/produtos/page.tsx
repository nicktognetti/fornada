import { Package } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { createClient } from '@/lib/supabase/server'
import { getPainelFinanceiro } from '@/app/actions/painel'
import { getUnidadePreferida } from '@/app/actions/unidade'
import { getConfigAction } from '@/app/actions/config'
import { LOCAIS_CONFIG_KEY, LOCAIS_PADRAO } from '@/app/lib/locais'
import { podeVerValoresProdutos } from '@/app/lib/authz'
import type { ProdutoAtendimento } from '@/app/actions/produto-atendimento'
import { ProdutoList } from './components/produto-list'

export default async function ProdutosPage() {
  const [unidadeId, supabase] = await Promise.all([
    getUnidadePreferida(),
    createClient(),
  ])

  const [result, unidadesRes, receitasRes, locaisEncomendaRes] = await Promise.all([
    getPainelFinanceiro(unidadeId ?? undefined),
    supabase.from('unidade').select('id, nome').order('nome'),
    supabase.from('vw_custo_receita').select('id, nome, custo_unitario, rendimento_unidade').eq('ativo', true)
      .not('nome', 'like', '- %')
      .not('nome', 'like', '%(sem nome)%')
      .order('nome')
      .limit(500),
    getConfigAction<string[]>(LOCAIS_CONFIG_KEY),
  ])

  // Local (setor), ficha ligada e campos do agente WhatsApp — não vêm na view financeira.
  type ProdutoExtra = {
    id: string; local: string | null; receita_id: string | null
    sempre_disponivel?: boolean | null; disponivel_hoje?: boolean | null
    foto_url?: string | null; sugestao_do_dia?: boolean | null
    vende_delivery?: boolean | null; vende_encomenda?: boolean | null
  }
  const CAMPOS_ATENDIMENTO = ', sempre_disponivel, disponivel_hoje, foto_url, sugestao_do_dia, vende_delivery, vende_encomenda'
  let localQuery = supabase.from('produto').select(`id, local, receita_id${CAMPOS_ATENDIMENTO}`).eq('ativo', true)
  if (unidadeId) localQuery = localQuery.eq('unidade_id', unidadeId)
  let locaisData = (await localQuery).data as ProdutoExtra[] | null
  let temAtendimento = locaisData !== null
  if (locaisData === null) {
    // Migration 20260705000000 ainda não aplicada — segue sem os campos do agente.
    let fb = supabase.from('produto').select('id, local, receita_id').eq('ativo', true)
    if (unidadeId) fb = fb.eq('unidade_id', unidadeId)
    locaisData = (await fb).data as ProdutoExtra[] | null
    temAtendimento = false
  }
  const extras = (locaisData ?? []) as ProdutoExtra[]
  const localMap: Record<string, string | null> = Object.fromEntries(extras.map((p) => [p.id, p.local]))
  const atendimentoMap: Record<string, ProdutoAtendimento> = temAtendimento
    ? Object.fromEntries(extras.map((p) => [p.id, {
        sempre_disponivel: p.sempre_disponivel ?? false,
        disponivel_hoje: p.disponivel_hoje ?? null,
        foto_url: p.foto_url ?? null,
        sugestao_do_dia: p.sugestao_do_dia ?? false,
        vende_delivery: p.vende_delivery !== false,
        vende_encomenda: p.vende_encomenda === true,
      }]))
    : {}
  // Fichas que já viraram produto nesta loja — não devem reaparecer no seletor de "Fabricado".
  const receitasUsadas = new Set(extras.map((p) => p.receita_id).filter(Boolean))

  // Valores (custo/preço/margem) só para admin de produtos ou quem tem
  // precos/painel — a operação (tem/acabou, robô) trabalha sem números.
  const { data: { user } } = await supabase.auth.getUser()
  const podeVerValores = user ? await podeVerValoresProdutos(user.id) : false

  const produtosBrutos = result.data?.fichas ?? []
  const produtos = podeVerValores
    ? produtosBrutos
    : produtosBrutos.map((p) => ({
        ...p,
        custo_total: 0,
        preco_venda: 0,
        margem_rs: 0,
        margem_percentual: 0,
        markup_percentual: 0,
      }))
  const unidades = (unidadesRes.data ?? []) as { id: string; nome: string }[]
  type FichaOpt = { id: string; nome: string; custo_unitario: number | null; rendimento_unidade: string | null }
  const receitas = ((receitasRes.data ?? []) as FichaOpt[])
    .filter((r) => !receitasUsadas.has(r.id))
    .map((r) => (podeVerValores ? r : { ...r, custo_unitario: null }))
  const locais = locaisEncomendaRes.data ?? LOCAIS_PADRAO

  return (
    <div className="max-w-4xl">
      <PageTitle icon={Package} subtitle="Gerencie produtos fabricados e de revenda">
        Produtos
      </PageTitle>

      <ProdutoList
        produtos={produtos}
        unidades={unidades}
        unidadeAtual={unidadeId ?? null}
        receitas={receitas}
        locais={locais}
        localMap={localMap}
        atendimentoMap={atendimentoMap}
        podeVerValores={podeVerValores}
      />
    </div>
  )
}
