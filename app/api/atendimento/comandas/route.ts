// API do AGENTE DE IMPRESSÃO local (térmica silenciosa).
// O script scripts/agente-impressao.mjs roda no computador da loja,
// consulta aqui os pedidos ainda não impressos e marca depois de imprimir.
//
//   GET  /api/atendimento/comandas?token=...&unidade=<id opcional>
//        → pedidos com impresso_em NULL (últimas 24h)
//   POST /api/atendimento/comandas   { token, ids: [...] }
//        → marca impresso_em = now()
//
// Proteção: token compartilhado (env IMPRESSAO_TOKEN). Sem o env
// configurado, a API fica desligada (503).

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'

function tokenValido(token: string | null): boolean {
  const esperado = process.env.IMPRESSAO_TOKEN
  if (!esperado || !token) return false
  // Comparação em tempo constante — `===` vaza o prefixo pelo tempo de resposta.
  const a = Buffer.from(token)
  const b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}

// Preferir o header (token em query string fica em log de proxy/CDN e histórico).
// A query segue aceita por compatibilidade com agentes de impressão antigos.
function tokenDoRequest(request: NextRequest, corpo?: { token?: unknown } | null): string | null {
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  if (typeof corpo?.token === 'string') return corpo.token
  return request.nextUrl.searchParams.get('token')
}

export async function GET(request: NextRequest) {
  if (!process.env.IMPRESSAO_TOKEN)
    return NextResponse.json({ erro: 'IMPRESSAO_TOKEN não configurado' }, { status: 503 })
  const params = request.nextUrl.searchParams
  if (!tokenValido(tokenDoRequest(request)))
    return NextResponse.json({ erro: 'token inválido' }, { status: 401 })

  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  let q = supabaseAdmin
    .from('atendimento_encomenda')
    .select('id, canal, produto, quantidade, data_texto, nome, endereco, criado_em, unidade:unidade_id ( nome ), conversa:conversa_id ( numero, nome )')
    .is('impresso_em', null)
    .gte('criado_em', desde)
    .order('criado_em', { ascending: true })
    .limit(20)
  const unidade = params.get('unidade')
  if (unidade) q = q.eq('unidade_id', unidade)

  const { data, error } = await q
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  type Row = {
    id: string; canal: string; produto: string; quantidade: string | null
    data_texto: string | null; nome: string | null; endereco: string | null; criado_em: string
    unidade: { nome: string } | { nome: string }[] | null
    conversa: { numero: string; nome: string | null } | { numero: string; nome: string | null }[] | null
  }
  const pedidos = ((data ?? []) as Row[]).map((r) => {
    const u = Array.isArray(r.unidade) ? r.unidade[0] : r.unidade
    const c = Array.isArray(r.conversa) ? r.conversa[0] : r.conversa
    return {
      id: r.id,
      canal: r.canal,
      produto: r.produto,
      quantidade: r.quantidade,
      data_texto: r.data_texto,
      nome: r.nome ?? c?.nome ?? null,
      endereco: r.endereco,
      criado_em: r.criado_em,
      unidade_nome: u?.nome ?? '',
      cliente_numero: c?.numero ?? '',
    }
  })

  return NextResponse.json({ pedidos })
}

export async function POST(request: NextRequest) {
  if (!process.env.IMPRESSAO_TOKEN)
    return NextResponse.json({ erro: 'IMPRESSAO_TOKEN não configurado' }, { status: 503 })
  const corpo = await request.json().catch(() => null)
  if (!tokenValido(tokenDoRequest(request, corpo)))
    return NextResponse.json({ erro: 'token inválido' }, { status: 401 })

  const ids: string[] = Array.isArray(corpo?.ids) ? corpo.ids.filter((i: unknown) => typeof i === 'string') : []
  if (ids.length === 0) return NextResponse.json({ marcados: 0 })

  const { data: marcadas, error } = await supabaseAdmin
    .from('atendimento_encomenda')
    .update({ impresso_em: new Date().toISOString() })
    .in('id', ids)
    .is('impresso_em', null)
    .select('id')
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  // Contagem REAL do update — `ids.length` contava como sucesso id inexistente
  // ou já impresso, e o agente não percebia comanda que ficou para trás.
  return NextResponse.json({ marcados: (marcadas ?? []).length })
}
