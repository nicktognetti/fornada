import { ArrowLeft, ArrowLeftRight } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NovaTransferenciaForm } from '../components/nova-transferencia-form'
import { getUnidadePreferida } from '@/app/actions/unidade'

type UnidadeRow = { id: string; nome: string; empresa_id: string }

export default async function NovaTransferenciaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? ''

  // Busca unidades a que o usuário tem acesso via usuario_unidade (bypassa usuario_empresa
  // que pode estar vazia para usuários criados antes da migration que faz o insert automático)
  const [uuResult, cookieId] = await Promise.all([
    supabaseAdmin
      .from('usuario_unidade')
      .select('unidade:unidade_id(id, nome, empresa_id)')
      .eq('user_id', userId),
    getUnidadePreferida(),
  ])

  const minhasUnidades: UnidadeRow[] = (uuResult.data ?? [])
    .map((r) => r.unidade as unknown as UnidadeRow)
    .filter(Boolean)

  // empresa do primeiro vínculo de loja
  const empresaId = minhasUnidades[0]?.empresa_id ?? ''

  // Todas as unidades da empresa + produtos
  const [todasResult, produtosResult] = await Promise.all([
    empresaId
      ? supabaseAdmin.from('unidade').select('id, nome').eq('empresa_id', empresaId).order('created_at')
      : Promise.resolve({ data: minhasUnidades }),
    empresaId
      ? supabaseAdmin.from('produto').select('id, nome').eq('empresa_id', empresaId).eq('ativo', true).order('nome')
      : Promise.resolve({ data: [] }),
  ])

  const todasUnidades: { id: string; nome: string }[] = todasResult.data ?? []
  const produtos: { id: string; nome: string }[] = produtosResult.data ?? []

  // Origem padrão: cookie (unidade selecionada pelo usuário) → primeira unidade vinculada
  const minhaUnidade =
    todasUnidades.find((u) => u.id === cookieId) ??
    (minhasUnidades[0] ? todasUnidades.find((u) => u.id === minhasUnidades[0].id) : null) ??
    null

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
          É preciso ter pelo menos duas unidades para criar uma transferência.
        </div>
      )}

      <NovaTransferenciaForm
        minhaUnidade={minhaUnidade}
        origemViaVinculo={false}
        todasUnidades={todasUnidades}
        produtos={produtos}
        empresaId={empresaId}
      />
    </div>
  )
}
