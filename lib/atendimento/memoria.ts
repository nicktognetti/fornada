// Memória de conversa do agente — agora nas tabelas do Fornada
// (atendimento_conversa / atendimento_mensagem / atendimento_encomenda),
// no lugar do Redis do projeto antigo.
//
// Estas funções usam supabaseAdmin porque rodam no WEBHOOK (sem sessão de
// usuário). O painel usa Server Actions com o cliente autenticado (RLS).

import { supabaseAdmin } from '@/lib/supabase/admin'
import type { CanalCtx } from './canal'
import type { DadosDaEncomenda } from './marcadores'

export type MensagemDaConversa = {
  role: 'user' | 'assistant'
  content: string
}

// Contexto enviado à IA: últimas 24h, no máximo 20 mensagens.
const MAX_MENSAGENS = 20
const JANELA_HORAS = 24

// Pausa (humano assumiu): 1h renovável.
export const DURACAO_PAUSA_MINUTOS = 60

export type ConversaAtiva = {
  id: string
  pausada: boolean
}

/**
 * Busca (ou cria) a conversa deste número neste (unidade, canal).
 * Atualiza `atualizado_em` e o nome do perfil (se veio no webhook).
 */
export async function obterOuCriarConversa(
  ctx: CanalCtx,
  numero: string,
  nomePerfil?: string | null,
): Promise<ConversaAtiva | null> {
  const { data: existente } = await supabaseAdmin
    .from('atendimento_conversa')
    .select('id, pausada_ate, nome')
    .eq('unidade_id', ctx.unidadeId)
    .eq('canal', ctx.canal)
    .eq('numero', numero)
    .maybeSingle()

  if (existente) {
    await supabaseAdmin
      .from('atendimento_conversa')
      .update({
        atualizado_em: new Date().toISOString(),
        ...(nomePerfil && !existente.nome ? { nome: nomePerfil } : {}),
      })
      .eq('id', existente.id)
    return {
      id: existente.id,
      pausada: !!existente.pausada_ate && new Date(existente.pausada_ate) > new Date(),
    }
  }

  const { data: nova, error } = await supabaseAdmin
    .from('atendimento_conversa')
    .insert({
      empresa_id: ctx.empresaId,
      unidade_id: ctx.unidadeId,
      canal: ctx.canal,
      numero,
      nome: nomePerfil || null,
    })
    .select('id')
    .single()

  if (error || !nova) {
    console.error('Erro ao criar conversa:', error?.message)
    return null
  }
  return { id: nova.id, pausada: false }
}

/** Histórico recente da conversa, no formato que a IA espera. */
export async function buscarHistorico(conversaId: string): Promise<MensagemDaConversa[]> {
  try {
    const desde = new Date(Date.now() - JANELA_HORAS * 60 * 60 * 1000).toISOString()
    const { data } = await supabaseAdmin
      .from('atendimento_mensagem')
      .select('role, conteudo')
      .eq('conversa_id', conversaId)
      .gte('criado_em', desde)
      .order('criado_em', { ascending: false })
      .limit(MAX_MENSAGENS)

    // Veio do mais novo pro mais velho (por causa do limit) — devolve em ordem
    return ((data ?? []) as { role: 'user' | 'assistant'; conteudo: string }[])
      .reverse()
      .map((m) => ({ role: m.role, content: m.conteudo }))
  } catch (erro) {
    console.error('Erro ao buscar histórico (seguindo sem memória):', erro)
    return []
  }
}

/** Grava mensagens na conversa (e toca o atualizado_em). */
export async function salvarMensagens(
  ctx: CanalCtx,
  conversaId: string,
  mensagens: MensagemDaConversa[],
): Promise<void> {
  if (mensagens.length === 0) return
  try {
    await supabaseAdmin.from('atendimento_mensagem').insert(
      mensagens.map((m) => ({
        empresa_id: ctx.empresaId,
        unidade_id: ctx.unidadeId,
        conversa_id: conversaId,
        role: m.role,
        conteudo: m.content,
      }))
    )
    await supabaseAdmin
      .from('atendimento_conversa')
      .update({ atualizado_em: new Date().toISOString() })
      .eq('id', conversaId)
  } catch (erro) {
    console.error('Erro ao salvar mensagens (mensagem já foi enviada):', erro)
  }
}

// Janela do anti-duplicata: se a IA marcar duas vezes o MESMO pedido na
// mesma conversa em poucos minutos (cliente confirmou 2×), não anota em dobro.
const JANELA_DUPLICATA_MINUTOS = 15

/**
 * Salva um pedido/encomenda anotado pelo agente (marcação #ENCOMENDA#).
 * Retorna o id da anotação, ou null se falhou/era duplicata.
 */
export async function salvarEncomendaAnotada(
  ctx: CanalCtx,
  conversaId: string,
  dados: DadosDaEncomenda,
): Promise<string | null> {
  try {
    // Anti-duplicata: mesmo produto + quantidade na mesma conversa há pouco?
    const desde = new Date(Date.now() - JANELA_DUPLICATA_MINUTOS * 60_000).toISOString()
    const { data: recente } = await supabaseAdmin
      .from('atendimento_encomenda')
      .select('id')
      .eq('conversa_id', conversaId)
      .eq('produto', dados.produto)
      .gte('criado_em', desde)
      .limit(1)
      .maybeSingle()
    if (recente) {
      console.log(`Pedido duplicado ignorado (conversa ${conversaId}: "${dados.produto}" já anotado há pouco).`)
      return null
    }

    const { data: nova, error } = await supabaseAdmin
      .from('atendimento_encomenda')
      .insert({
        empresa_id: ctx.empresaId,
        unidade_id: ctx.unidadeId,
        conversa_id: conversaId,
        canal: ctx.canal,
        produto: dados.produto,
        quantidade: dados.quantidade,
        data_texto: dados.data,
        nome: dados.nome,
        endereco: dados.endereco,
        status: 'anotada',
      })
      .select('id')
      .single()
    if (error) {
      console.error('Erro ao salvar encomenda anotada:', error.message)
      return null
    }
    return nova.id
  } catch (erro) {
    console.error('Erro ao salvar encomenda anotada:', erro)
    return null
  }
}
