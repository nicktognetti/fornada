'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { temAcesso } from '@/app/lib/authz'
import { getUnidadePreferida } from '@/app/actions/unidade'
import { criarEncomenda } from '@/app/actions/encomenda'
import { enviarMensagemTexto } from '@/lib/atendimento/whatsapp'
import { phoneNumberIdParaEnvio, type CanalAtendimento } from '@/lib/atendimento/canal'
import { DURACAO_PAUSA_MINUTOS } from '@/lib/atendimento/memoria'

type ActionResult<T = void> = T extends void
  ? { error?: string; success?: boolean }
  : { error?: string; data?: T }

export type ConversaResumo = {
  id: string
  numero: string
  nome: string | null
  canal: CanalAtendimento
  pausada: boolean
  atualizado_em: string
  ultima_mensagem: string | null
  encomendas_anotadas: number
}

export type MensagemAtendimento = {
  id: string
  role: 'user' | 'assistant'
  conteudo: string
  criado_em: string
}

export type EncomendaAnotada = {
  id: string
  canal: CanalAtendimento
  produto: string
  quantidade: string | null
  data_texto: string | null
  nome: string | null
  endereco: string | null
  status: 'anotada' | 'confirmada' | 'virou_pedido'
  encomenda_id: string | null
  criado_em: string
}

export type ConversaDetalhe = {
  id: string
  numero: string
  nome: string | null
  canal: CanalAtendimento
  pausada: boolean
  mensagens: MensagemAtendimento[]
  encomendas: EncomendaAnotada[]
}

// ── Listar conversas (unidade atual, filtro por canal) ────────────────────────
export async function listarConversas(
  canal?: CanalAtendimento | 'todos',
): Promise<ActionResult<{ conversas: ConversaResumo[]; unidadeId: string | null }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!(await temAcesso(user.id, ['atendimento'], { nivel: 'leitura' })))
    return { error: 'Sem permissão para ver o atendimento' }

  const unidadeId = await getUnidadePreferida()

  let q = supabase
    .from('atendimento_conversa')
    .select('id, numero, nome, canal, pausada_ate, atualizado_em')
    .order('atualizado_em', { ascending: false })
    .limit(50)
  if (unidadeId) q = q.eq('unidade_id', unidadeId)
  if (canal && canal !== 'todos') q = q.eq('canal', canal)

  const { data, error } = await q
  if (error) return { error: error.message }

  type Row = { id: string; numero: string; nome: string | null; canal: CanalAtendimento; pausada_ate: string | null; atualizado_em: string }
  const rows = (data ?? []) as Row[]
  const ids = rows.map((r) => r.id)

  // Última mensagem + encomendas pendentes por conversa (2 queries em lote)
  const ultimaMap = new Map<string, string>()
  const encomendaCount = new Map<string, number>()
  if (ids.length > 0) {
    const [msgsRes, encRes] = await Promise.all([
      supabase
        .from('atendimento_mensagem')
        .select('conversa_id, conteudo, criado_em')
        .in('conversa_id', ids)
        .order('criado_em', { ascending: false })
        .limit(400),
      supabase
        .from('atendimento_encomenda')
        .select('conversa_id')
        .in('conversa_id', ids)
        .eq('status', 'anotada'),
    ])
    for (const m of (msgsRes.data ?? []) as { conversa_id: string; conteudo: string }[]) {
      if (!ultimaMap.has(m.conversa_id)) ultimaMap.set(m.conversa_id, m.conteudo)
    }
    for (const e of (encRes.data ?? []) as { conversa_id: string }[]) {
      encomendaCount.set(e.conversa_id, (encomendaCount.get(e.conversa_id) ?? 0) + 1)
    }
  }

  const agora = new Date()
  const conversas: ConversaResumo[] = rows.map((r) => ({
    id: r.id,
    numero: r.numero,
    nome: r.nome,
    canal: r.canal,
    pausada: !!r.pausada_ate && new Date(r.pausada_ate) > agora,
    atualizado_em: r.atualizado_em,
    ultima_mensagem: ultimaMap.get(r.id) ?? null,
    encomendas_anotadas: encomendaCount.get(r.id) ?? 0,
  }))

  return { data: { conversas, unidadeId } }
}

// ── Detalhe de uma conversa (mensagens + pedidos anotados) ────────────────────
export async function getConversa(conversaId: string): Promise<ActionResult<ConversaDetalhe>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!(await temAcesso(user.id, ['atendimento'], { nivel: 'leitura' })))
    return { error: 'Sem permissão para ver o atendimento' }

  const [convRes, msgsRes, encRes] = await Promise.all([
    supabase
      .from('atendimento_conversa')
      .select('id, numero, nome, canal, pausada_ate')
      .eq('id', conversaId)
      .maybeSingle(),
    supabase
      .from('atendimento_mensagem')
      .select('id, role, conteudo, criado_em')
      .eq('conversa_id', conversaId)
      .order('criado_em', { ascending: true })
      .limit(200),
    supabase
      .from('atendimento_encomenda')
      .select('id, canal, produto, quantidade, data_texto, nome, endereco, status, encomenda_id, criado_em')
      .eq('conversa_id', conversaId)
      .order('criado_em', { ascending: false }),
  ])

  const conv = convRes.data as { id: string; numero: string; nome: string | null; canal: CanalAtendimento; pausada_ate: string | null } | null
  if (!conv) return { error: 'Conversa não encontrada' }

  return {
    data: {
      id: conv.id,
      numero: conv.numero,
      nome: conv.nome,
      canal: conv.canal,
      pausada: !!conv.pausada_ate && new Date(conv.pausada_ate) > new Date(),
      mensagens: (msgsRes.data ?? []) as MensagemAtendimento[],
      encomendas: (encRes.data ?? []) as EncomendaAnotada[],
    },
  }
}

// ── Assumir / devolver a conversa ─────────────────────────────────────────────
// Assumir = robô fica mudo por 1h (renovável a cada resposta do humano).
export async function assumirConversa(conversaId: string): Promise<ActionResult> {
  return setPausa(conversaId, new Date(Date.now() + DURACAO_PAUSA_MINUTOS * 60_000).toISOString())
}

export async function devolverConversa(conversaId: string): Promise<ActionResult> {
  return setPausa(conversaId, null)
}

async function setPausa(conversaId: string, pausadaAte: string | null): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!(await temAcesso(user.id, ['atendimento'])))
    return { error: 'Sem permissão para assumir conversas' }

  const { error } = await supabase
    .from('atendimento_conversa')
    .update({ pausada_ate: pausadaAte })
    .eq('id', conversaId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/atendimento')
  return { success: true }
}

// ── Responder pelo painel (humano manda mensagem no WhatsApp) ─────────────────
export async function responderConversa(conversaId: string, texto: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!texto.trim()) return { error: 'Escreva a mensagem' }
  if (!(await temAcesso(user.id, ['atendimento'])))
    return { error: 'Sem permissão para responder conversas' }

  // RLS garante que o usuário só enxerga conversas das lojas dele
  const { data: conv } = await supabase
    .from('atendimento_conversa')
    .select('id, empresa_id, unidade_id, canal, numero')
    .eq('id', conversaId)
    .maybeSingle()
  if (!conv) return { error: 'Conversa não encontrada' }

  const phoneNumberId = await phoneNumberIdParaEnvio(conv.unidade_id, conv.canal as CanalAtendimento)
  if (!phoneNumberId) return { error: 'Número de envio não configurado (atendimento_canal)' }

  const enviado = await enviarMensagemTexto(phoneNumberId, conv.numero, texto.trim())
  if (!enviado) return { error: 'O WhatsApp recusou o envio — veja os logs' }

  // Guarda no histórico e renova a pausa (humano ativo = robô mudo)
  const { error: e1 } = await supabase.from('atendimento_mensagem').insert({
    empresa_id: conv.empresa_id,
    unidade_id: conv.unidade_id,
    conversa_id: conversaId,
    role: 'assistant',
    conteudo: texto.trim(),
  })
  if (e1) return { error: `Mensagem enviada, mas falhou ao registrar: ${e1.message}` }

  await supabase
    .from('atendimento_conversa')
    .update({
      pausada_ate: new Date(Date.now() + DURACAO_PAUSA_MINUTOS * 60_000).toISOString(),
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', conversaId)

  revalidatePath('/dashboard/atendimento')
  return { success: true }
}

// ── Pedidos anotados (visão consolidada — aba "Pedidos") ─────────────────────
// A Natali acompanha o que o robô anotou POR DIA, por canal e por loja,
// sem precisar abrir conversa por conversa.

export type PedidoAnotado = EncomendaAnotada & {
  conversa_id: string
  cliente_numero: string
  cliente_nome: string | null
}

export async function listarPedidos(filtros?: {
  canal?: CanalAtendimento | 'todos'
  status?: 'anotada' | 'confirmada' | 'virou_pedido' | 'todos'
  /** YYYY-MM-DD (dia local). Omitido = todos os dias. */
  data?: string | null
}): Promise<ActionResult<{ pedidos: PedidoAnotado[] }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!(await temAcesso(user.id, ['atendimento'], { nivel: 'leitura' })))
    return { error: 'Sem permissão para ver o atendimento' }

  const unidadeId = await getUnidadePreferida()

  let q = supabase
    .from('atendimento_encomenda')
    .select('id, conversa_id, canal, produto, quantidade, data_texto, nome, endereco, status, encomenda_id, criado_em, conversa:conversa_id ( numero, nome )')
    .order('criado_em', { ascending: false })
    .limit(200)
  if (unidadeId) q = q.eq('unidade_id', unidadeId)
  if (filtros?.canal && filtros.canal !== 'todos') q = q.eq('canal', filtros.canal)
  if (filtros?.status && filtros.status !== 'todos') q = q.eq('status', filtros.status)
  if (filtros?.data) {
    // Dia local da padaria (Brasil, UTC-3)
    const inicio = `${filtros.data}T00:00:00-03:00`
    const fimDate = new Date(`${filtros.data}T00:00:00-03:00`)
    fimDate.setDate(fimDate.getDate() + 1)
    q = q.gte('criado_em', inicio).lt('criado_em', fimDate.toISOString())
  }

  const { data, error } = await q
  if (error) return { error: error.message }

  type Row = Omit<PedidoAnotado, 'cliente_numero' | 'cliente_nome'> & {
    conversa: { numero: string; nome: string | null } | { numero: string; nome: string | null }[] | null
  }
  const pedidos: PedidoAnotado[] = ((data ?? []) as Row[]).map((r) => {
    const conv = Array.isArray(r.conversa) ? r.conversa[0] : r.conversa
    return {
      id: r.id,
      conversa_id: r.conversa_id,
      canal: r.canal,
      produto: r.produto,
      quantidade: r.quantidade,
      data_texto: r.data_texto,
      nome: r.nome,
      endereco: r.endereco,
      status: r.status,
      encomenda_id: r.encomenda_id,
      criado_em: r.criado_em,
      cliente_numero: conv?.numero ?? '',
      cliente_nome: conv?.nome ?? null,
    }
  })

  return { data: { pedidos } }
}

// ── Contador de pedidos pendentes (badge no menu) ─────────────────────────────
export async function contarPedidosPendentes(): Promise<ActionResult<{ total: number }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!(await temAcesso(user.id, ['atendimento'], { nivel: 'leitura' }))) return { data: { total: 0 } }

  const unidadeId = await getUnidadePreferida()
  let q = supabase
    .from('atendimento_encomenda')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'anotada')
  if (unidadeId) q = q.eq('unidade_id', unidadeId)
  const { count, error } = await q
  if (error) return { error: error.message }
  return { data: { total: count ?? 0 } }
}

// ── Canais (aba "Robô": números por loja + aviso à equipe) ────────────────────

export type CanalConfig = {
  id: string
  unidade_id: string
  unidade_nome: string
  canal: CanalAtendimento
  phone_number_id: string
  numero_exibicao: string | null
  ativo: boolean
  avisar_ativo: boolean
  avisar_numero: string | null
  pedido_auto: boolean
}

export async function listarCanais(): Promise<ActionResult<{ canais: CanalConfig[]; unidades: { id: string; nome: string }[] }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!(await temAcesso(user.id, ['atendimento'], { nivel: 'leitura' })))
    return { error: 'Sem permissão' }

  const [canaisRes, unidadesRes] = await Promise.all([
    supabase
      .from('atendimento_canal')
      .select('id, unidade_id, canal, phone_number_id, numero_exibicao, ativo, avisar_ativo, avisar_numero, pedido_auto, unidade:unidade_id ( nome )')
      .order('canal'),
    supabase.from('unidade').select('id, nome').eq('ativo', true).order('nome'),
  ])
  if (canaisRes.error) return { error: canaisRes.error.message }

  type Row = Omit<CanalConfig, 'unidade_nome'> & { unidade: { nome: string } | { nome: string }[] | null }
  const canais: CanalConfig[] = ((canaisRes.data ?? []) as Row[]).map((r) => {
    const u = Array.isArray(r.unidade) ? r.unidade[0] : r.unidade
    return {
      id: r.id,
      unidade_id: r.unidade_id,
      unidade_nome: u?.nome ?? '',
      canal: r.canal,
      phone_number_id: r.phone_number_id,
      numero_exibicao: r.numero_exibicao,
      ativo: r.ativo,
      avisar_ativo: r.avisar_ativo,
      avisar_numero: r.avisar_numero,
      pedido_auto: r.pedido_auto,
    }
  })

  return { data: { canais, unidades: (unidadesRes.data ?? []) as { id: string; nome: string }[] } }
}

// Criar/atualizar canal exige nível ADMIN na tela atendimento (é configuração).
export async function salvarCanal(dados: {
  id?: string
  unidade_id: string
  canal: CanalAtendimento
  phone_number_id: string
  numero_exibicao?: string | null
  ativo?: boolean
  avisar_ativo?: boolean
  avisar_numero?: string | null
  pedido_auto?: boolean
}): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!(await temAcesso(user.id, ['atendimento'], { nivel: 'admin', unidadeId: dados.unidade_id })))
    return { error: 'Só admin do Atendimento pode configurar os números' }
  if (!dados.phone_number_id.trim()) return { error: 'Informe o Phone Number ID (painel da Meta)' }
  if (dados.avisar_ativo && !dados.avisar_numero?.trim())
    return { error: 'Para ligar o aviso, informe o número da equipe (com DDI, ex: 5511999999999)' }

  const payload = {
    unidade_id: dados.unidade_id,
    canal: dados.canal,
    phone_number_id: dados.phone_number_id.trim(),
    numero_exibicao: dados.numero_exibicao?.trim() || null,
    ativo: dados.ativo ?? true,
    avisar_ativo: dados.avisar_ativo ?? false,
    avisar_numero: dados.avisar_numero?.trim().replace(/\D/g, '') || null,
    pedido_auto: dados.pedido_auto ?? false,
  }

  if (dados.id) {
    const { error } = await supabase.from('atendimento_canal').update(payload).eq('id', dados.id)
    if (error) return { error: error.message }
    revalidatePath('/dashboard/atendimento')
    return { data: { id: dados.id } }
  }

  // empresa da unidade (para o insert)
  const { data: unidade } = await supabase
    .from('unidade').select('empresa_id').eq('id', dados.unidade_id).maybeSingle()
  if (!unidade) return { error: 'Unidade não encontrada' }

  const { data: novo, error } = await supabase
    .from('atendimento_canal')
    .insert({ ...payload, empresa_id: unidade.empresa_id })
    .select('id')
    .single()
  if (error) {
    if (error.message.includes('atendimento_canal_unidade_id_canal_key') || error.code === '23505')
      return { error: 'Já existe um número para este canal nesta loja (edite o existente)' }
    return { error: error.message }
  }

  revalidatePath('/dashboard/atendimento')
  return { data: { id: novo.id } }
}

// ── Marcar encomenda anotada como confirmada ──────────────────────────────────
export async function confirmarEncomendaAnotada(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!(await temAcesso(user.id, ['atendimento']))) return { error: 'Sem permissão' }

  const { error } = await supabase
    .from('atendimento_encomenda')
    .update({ status: 'confirmada' })
    .eq('id', id)
    .eq('status', 'anotada')
  if (error) return { error: error.message }

  revalidatePath('/dashboard/atendimento')
  return { success: true }
}

// ── Virar pedido: cria a encomenda OFICIAL no módulo de encomendas ────────────
// O anotado pelo robô é texto livre; o atendente completa data/hora reais.
export async function virarPedido(
  atendimentoEncomendaId: string,
  dados: { data_entrega: string; hora_entrega: string; quantidade: number },
): Promise<ActionResult<{ encomendaId: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!(await temAcesso(user.id, ['atendimento']))) return { error: 'Sem permissão' }

  const { data: anotada } = await supabase
    .from('atendimento_encomenda')
    .select('id, produto, quantidade, nome, endereco, canal, status, conversa:conversa_id ( numero, nome )')
    .eq('id', atendimentoEncomendaId)
    .maybeSingle()
  if (!anotada) return { error: 'Encomenda anotada não encontrada' }
  if (anotada.status === 'virou_pedido') return { error: 'Esta anotação já virou pedido' }

  const conversa = Array.isArray(anotada.conversa) ? anotada.conversa[0] : anotada.conversa
  const clienteNome = anotada.nome?.trim() || conversa?.nome?.trim() || conversa?.numero || 'Cliente WhatsApp'

  const obs = [
    `Via agente WhatsApp (${anotada.canal === 'delivery' ? 'Delivery' : 'Encomendas'})`,
    anotada.quantidade ? `Quantidade anotada: ${anotada.quantidade}` : null,
    anotada.endereco ? `Entrega: ${anotada.endereco}` : null,
  ].filter(Boolean).join(' · ')

  // criarEncomenda valida permissão da tela encomenda + loja e registra o status
  const res = await criarEncomenda(
    {
      cliente_nome: clienteNome,
      cliente_contato: conversa?.numero ?? null,
      data_entrega: dados.data_entrega,
      hora_entrega: dados.hora_entrega,
      com_valor: false,
      rastrear_status: true,
      observacao: obs,
    },
    [{
      produto_id: null,
      descricao: anotada.produto,
      quantidade: dados.quantidade > 0 ? dados.quantidade : 1,
      preco_unitario: 0,
      observacao: anotada.quantidade ? `Cliente pediu: ${anotada.quantidade}` : null,
      local: null,
    }],
  )
  if (res.error || !res.data) return { error: res.error ?? 'Erro ao criar a encomenda' }

  await supabase
    .from('atendimento_encomenda')
    .update({ status: 'virou_pedido', encomenda_id: res.data.id })
    .eq('id', atendimentoEncomendaId)

  revalidatePath('/dashboard/atendimento')
  revalidatePath('/dashboard/encomendas')
  return { data: { encomendaId: res.data.id } }
}
