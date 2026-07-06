import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Mapeia uma rota do dashboard para a "tela" de permissão correspondente.
// Retorna null para rotas livres (landing) ou desconhecidas (fail-open: a
// página + RLS + temAcesso continuam protegendo dados e escrita).
function telaParaRota(pathname: string): string | null {
  if (pathname === '/dashboard' || pathname === '/dashboard/') return null
  // Ordem importa: /receber é mais específico que /transferencias
  if (pathname.startsWith('/dashboard/transferencias/receber')) return 'receber'
  if (pathname.startsWith('/dashboard/transferencias')) return 'transferencias'
  const seg = pathname.split('/')[2] // segmento após /dashboard/
  const mapa: Record<string, string> = {
    resumo: 'resumo',
    insumos: 'insumos',
    receitas: 'receitas',
    precos: 'precos',
    produtos: 'produtos',
    painel: 'painel',
    cadastros: 'cadastros',
    simulador: 'simulador',
    orcamentos: 'orcamento',
    encomendas: 'encomenda',
    clientes: 'clientes',
    atendimento: 'atendimento',
    configuracoes: 'configuracoes',
  }
  return mapa[seg] ?? null
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isLoginPage = pathname === '/login'
  // APIs do atendimento chamadas SEM sessão: o webhook (Meta) e as
  // comandas (agente de impressão local). Cada rota se protege sozinha
  // (VERIFY_TOKEN / IMPRESSAO_TOKEN).
  const isApiAtendimento =
    pathname.startsWith('/api/atendimento/webhook') ||
    pathname.startsWith('/api/atendimento/comandas')
  const isPublicPath = isLoginPage || isApiAtendimento

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Guard de permissão por tela: o menu esconde telas não concedidas, mas sem
  // isto a rota ainda abriria via URL direta (exposição de visualização do
  // módulo dentro da própria loja). Aqui barramos no servidor, central.
  if (user) {
    const tela = telaParaRota(pathname)
    if (tela) {
      const { data: perms, error } = await supabase
        .from('permissao')
        .select('tela')
        .eq('usuario_id', user.id)
      // Fail-open em erro transitório (dados/escrita seguem protegidos por RLS/temAcesso)
      if (!error && Array.isArray(perms)) {
        const telas = new Set(perms.map((p: { tela: string }) => p.tela))
        const autorizado = telas.has('*') || telas.has(tela)
        if (!autorizado) {
          const url = request.nextUrl.clone()
          url.pathname = '/dashboard'
          url.search = ''
          return NextResponse.redirect(url)
        }
      }
    }
  }

  return supabaseResponse
}

export const config = {
  // Exclui assets estáticos do public/ (images, fonts, etc.) para evitar
  // que o middleware de autenticação bloqueie recursos públicos como o logo
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
