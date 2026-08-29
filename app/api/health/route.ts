import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Keep-alive do Supabase: o plano free pausa projeto sem tráfego; o cron da Vercel
// chama esta rota diariamente e faz uma leitura mínima para manter o banco ativo.
export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { error } = await supabase.from('empresa').select('id').limit(1)
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, at: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
