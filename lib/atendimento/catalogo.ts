// Catálogo que o agente consulta (ferramenta consultar_produtos).
// Consulta DIRETA no banco (antes era via PostgREST do projeto irmão),
// filtrada pela LOJA do número e pelo CANAL (encomendas × delivery).

import { supabaseAdmin } from '@/lib/supabase/admin'
import { valorPorGrande, unidadeGrande } from '@/lib/format'
import type { CanalAtendimento } from './canal-tipos'
import { calcularDisponibilidade, type Disponibilidade, type FlagsProduto } from './disponibilidade'

export { calcularDisponibilidade }
export type { Disponibilidade }

// Um produto no formato que a IA entende
export type ProdutoDoCatalogo = {
  nome: string
  categoria: string | null
  preco: number | null // na unidade de venda (ex: 42.5 por kg)
  unidade_venda: string // "kg", "L" ou "un"
  disponibilidade: Disponibilidade
  foto_url: string | null // uso interno — a IA recebe só tem_foto
  sugestao_do_dia: boolean
}

/**
 * Busca produtos pelo nome, na loja e canal do número que recebeu a
 * mensagem. Retorna [] se nada encontrado; null em erro (o agente
 * responde "confirmo com a equipe").
 */
// Faixa dos acentos combinantes do Unicode (após normalize NFD)
const ACENTOS = /[̀-ͯ]/g

/** "Pão" → "pao": cliente escreve sem acento e o produto está com acento (e vice-versa). */
function semAcento(s: string): string {
  return s.normalize('NFD').replace(ACENTOS, '').toLowerCase()
}

type LinhaView = { produto_id: string; produto_nome: string; categoria: string | null; preco_venda: number | null }

export async function buscarProdutos(
  termo: string,
  unidadeId: string,
  canal: CanalAtendimento,
): Promise<ProdutoDoCatalogo[] | null> {
  try {
    const termoLimpo = termo.replace(/[%*(),]/g, ' ').trim()
    if (!termoLimpo) return []

    const primeira = await supabaseAdmin
      .from('vw_produto_financeiro')
      .select('produto_id, produto_nome, categoria, preco_venda')
      .eq('unidade_id', unidadeId)
      .ilike('produto_nome', `%${termoLimpo}%`)
      .limit(8)
    let linhas = primeira.data
    const error = primeira.error
    if (error) {
      console.error('Atendimento: falha na consulta ao catálogo:', error.message)
      return null
    }

    // ilike é sensível a acento ("pao" não acha "Pão") — fallback: busca os
    // nomes da loja e compara sem acento aqui.
    if (!linhas || linhas.length === 0) {
      const { data: todos, error: e2 } = await supabaseAdmin
        .from('vw_produto_financeiro')
        .select('produto_id, produto_nome, categoria, preco_venda')
        .eq('unidade_id', unidadeId)
        .limit(1000)
      if (e2) {
        console.error('Atendimento: falha na consulta ao catálogo:', e2.message)
        return null
      }
      const alvo = semAcento(termoLimpo)
      linhas = ((todos ?? []) as LinhaView[])
        .filter((l) => semAcento(l.produto_nome).includes(alvo))
        .slice(0, 8)
    }
    if (!linhas || linhas.length === 0) return []

    const ids = linhas.map((l) => l.produto_id)
    const { data: prods } = await supabaseAdmin
      .from('produto')
      .select(
        'id, sempre_disponivel, disponivel_hoje, foto_url, sugestao_do_dia, vende_delivery, vende_encomenda, receita:receita_id ( rendimento_unidade )'
      )
      .in('id', ids)

    type LinhaProduto = FlagsProduto & {
      id: string
      foto_url: string | null
      sugestao_do_dia: boolean | null
      receita: { rendimento_unidade: string | null } | { rendimento_unidade: string | null }[] | null
    }
    const porId = new Map(((prods ?? []) as LinhaProduto[]).map((p) => [p.id, p]))

    return linhas.map((linha) => {
      const produto = porId.get(linha.produto_id)
      const receita = Array.isArray(produto?.receita) ? produto?.receita[0] : produto?.receita
      const unidadeBase = receita?.rendimento_unidade ?? null
      const preco = linha.preco_venda != null ? Number(linha.preco_venda) : null

      return {
        nome: linha.produto_nome,
        categoria: linha.categoria,
        // Preço por unidade de VENDA (kg/L/un) — a view guarda por grama p/ fichas em peso
        preco: preco != null && preco > 0 ? Number(valorPorGrande(preco, unidadeBase).toFixed(2)) : null,
        unidade_venda: unidadeGrande(unidadeBase),
        disponibilidade: calcularDisponibilidade(produto, canal),
        foto_url: produto?.foto_url ?? null,
        sugestao_do_dia: produto?.sugestao_do_dia === true,
      }
    })
  } catch (erro) {
    console.error('Erro ao buscar produtos do catálogo:', erro)
    return null
  }
}
