import { ArrowLeft, ArrowLeftRight } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NovaTransferenciaForm } from '../components/nova-transferencia-form'
import { getUnidadePreferida } from '@/app/actions/unidade'

export default async function NovaTransferenciaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? ''

  // Origem = unidade do cookie (selecionada pelo usuário)
  const cookieId = await getUnidadePreferida()

  // Busca a unidade do cookie para obter empresa_id — não depende de usuario_empresa
  // (pode estar vazia para usuários criados antes da migration de insert automático)
  const { data: cookieUnit } = cookieId
    ? await supabaseAdmin.from('unidade').select('id, nome, empresa_id').eq('id', cookieId).maybeSingle()
    : { data: null }

  const empresaId = cookieUnit?.empresa_id ?? ''

  // Fallback: busca empresa via usuario_unidade se cookie não resolveu
  let empresaIdFinal = empresaId
  if (!empresaIdFinal) {
    const { data: uuRows } = await supabaseAdmin
      .from('usuario_unidade')
      .select('unidade_id')
      .eq('user_id', userId)
      .limit(1)
    const primeiraUnidadeId = uuRows?.[0]?.unidade_id
    if (primeiraUnidadeId) {
      const { data: u } = await supabaseAdmin
        .from('unidade').select('empresa_id').eq('id', primeiraUnidadeId).maybeSingle()
      empresaIdFinal = u?.empresa_id ?? ''
    }
  }

  // Todas as unidades da empresa + produtos em paralelo
  const [todasResult, produtosResult] = await Promise.all([
    empresaIdFinal
      ? supabaseAdmin.from('unidade').select('id, nome').eq('empresa_id', empresaIdFinal).order('created_at')
      : { data: [] },
    empresaIdFinal
      ? supabaseAdmin.from('produto').select('id, nome').eq('empresa_id', empresaIdFinal).eq('ativo', true).order('nome')
      : { data: [] },
  ])

  const todasUnidades = (todasResult.data ?? []) as { id: string; nome: string }[]
  const produtos      = (produtosResult.data ?? []) as { id: string; nome: string }[]

  // Origem padrão = unidade do cookie (se ainda estiver na lista da empresa)
  const minhaUnidade = todasUnidades.find((u) => u.id === cookieId) ?? todasUnidades[0] ?? null

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/dashboard/transferencias"
          className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-accent-primary transition-colors"
        >
          <ArrowLeft size={15} />
          Transferências
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-8">
        <ArrowLeftRight size={22} className="text-accent-primary shrink-0" />
        <div>
          <h1 className="text-2xl font-semibold text-primary">Nova transferência</h1>
          <p className="text-sm text-secondary mt-0.5">Enviar produtos para outra unidade</p>
        </div>
      </div>

      {todasUnidades.length < 2 && (
        <div className="mb-5 bg-amber-500/8 border border-amber-500/25 text-amber-400 rounded-lg px-4 py-3 text-sm">
          Selecione uma unidade de origem no seletor acima e recarregue a página.
        </div>
      )}

      <NovaTransferenciaForm
        minhaUnidade={minhaUnidade}
        origemViaVinculo={false}
        todasUnidades={todasUnidades}
        produtos={produtos}
        empresaId={empresaIdFinal}
      />
    </div>
  )
}
