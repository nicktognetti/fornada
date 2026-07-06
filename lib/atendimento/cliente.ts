// Memória de cliente do atendimento: liga o número de WhatsApp ao
// cadastro de Clientes do Fornada (a mesma tabela dos orçamentos e
// encomendas, por loja). Roda no webhook → supabaseAdmin.

import { supabaseAdmin } from '@/lib/supabase/admin'
import { formatarFichaCliente, type FichaCliente } from './ficha-texto'
import type { CanalCtx } from './canal'
import type { DadosDaEncomenda } from './marcadores'

type ClienteRow = {
  id: string
  nome: string
  telefone: string | null
  endereco: string | null
  observacao: string | null
}

/** Busca o cliente da loja pelo telefone (número do WhatsApp). */
async function buscarClientePorTelefone(unidadeId: string, numero: string): Promise<ClienteRow | null> {
  const { data } = await supabaseAdmin
    .from('cliente')
    .select('id, nome, telefone, endereco, observacao')
    .eq('unidade_id', unidadeId)
    .eq('telefone', numero)
    .limit(1)
    .maybeSingle()
  return (data as ClienteRow | null) ?? null
}

/**
 * Cria/atualiza o cliente quando o robô anota um pedido:
 * telefone = número do WhatsApp; nome e endereço vêm do pedido.
 * Nunca sobrescreve dado preenchido com dado pior (só completa vazios).
 */
export async function upsertClienteAtendimento(
  ctx: CanalCtx,
  numero: string,
  dados: DadosDaEncomenda,
  nomePerfil?: string | null,
): Promise<void> {
  try {
    const nome = (dados.nome && dados.nome !== '?' ? dados.nome : nomePerfil ?? '').trim()
    const endereco = dados.endereco?.trim() || null

    const existente = await buscarClientePorTelefone(ctx.unidadeId, numero)
    if (existente) {
      const patch: Record<string, string> = {}
      if (endereco && !existente.endereco) patch.endereco = endereco
      if (nome && (!existente.nome || existente.nome === numero)) patch.nome = nome
      if (Object.keys(patch).length > 0) {
        await supabaseAdmin.from('cliente').update(patch).eq('id', existente.id)
      }
      return
    }

    if (!nome) return // sem nome não polui o cadastro

    const { error } = await supabaseAdmin.from('cliente').insert({
      empresa_id: ctx.empresaId,
      unidade_id: ctx.unidadeId,
      nome,
      telefone: numero,
      endereco,
      observacao: `Cadastrado pelo robô do WhatsApp (${ctx.canal})`,
    })
    // Nome já existe na loja (outro telefone): diferencia pelo final do número
    if (error?.code === '23505') {
      await supabaseAdmin.from('cliente').insert({
        empresa_id: ctx.empresaId,
        unidade_id: ctx.unidadeId,
        nome: `${nome} (${numero.slice(-4)})`,
        telefone: numero,
        endereco,
        observacao: `Cadastrado pelo robô do WhatsApp (${ctx.canal})`,
      })
    }
  } catch (erro) {
    console.error('Erro ao cadastrar cliente do atendimento (pedido segue normal):', erro)
  }
}

/**
 * Ficha do cliente para o prompt do agente (nome, endereço salvo,
 * últimos pedidos). null = cliente desconhecido (primeira vez).
 */
export async function buscarFichaCliente(ctx: CanalCtx, numero: string): Promise<string | null> {
  try {
    const [cliente, pedidosRes] = await Promise.all([
      buscarClientePorTelefone(ctx.unidadeId, numero),
      supabaseAdmin
        .from('atendimento_encomenda')
        .select('produto, criado_em, conversa:conversa_id ( numero )')
        .eq('unidade_id', ctx.unidadeId)
        .order('criado_em', { ascending: false })
        .limit(20),
    ])

    // Filtra os pedidos deste número (join simples via conversa)
    type PedRow = { produto: string; criado_em: string; conversa: { numero: string } | { numero: string }[] | null }
    const ultimosPedidos = ((pedidosRes.data ?? []) as PedRow[])
      .filter((p) => {
        const conv = Array.isArray(p.conversa) ? p.conversa[0] : p.conversa
        return conv?.numero === numero
      })
      .slice(0, 3)
      .map((p) => ({
        produto: p.produto,
        quando: new Date(p.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      }))

    const ficha: FichaCliente = {
      nome: cliente?.nome ?? null,
      endereco: cliente?.endereco ?? null,
      observacao: cliente?.observacao?.startsWith('Cadastrado pelo robô') ? null : cliente?.observacao ?? null,
      ultimosPedidos,
    }
    return formatarFichaCliente(ficha)
  } catch (erro) {
    console.error('Erro ao buscar ficha do cliente (seguindo sem ela):', erro)
    return null
  }
}
