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

  const cookieId = await getUnidadePreferida()

  // empresa_id via usuario_empresa (fonte mais confiável — funciona independente de RLS)
  const { data: ueRow } = await supabaseAdmin
    .from('usuario_empresa')
    .select('empresa_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()
  const empresaIdFinal = ueRow?.empresa_id ?? ''

  // Unidades via usuario_unidade (não depende de empresa_id na tabela unidade)
  const { data: vinculos } = await supabaseAdmin
    .from('usuario_unidade')
    .select('unidade_id')
    .eq('user_id', userId)
  const unidadeIds = vinculos?.map((v: { unidade_id: string }) => v.unidade_id) ?? []

  const [todasResult, todasEmpresaResult, produtosResult] = await Promise.all([
    unidadeIds.length > 0
      ? supabaseAdmin.from('unidade').select('id, nome').in('id', unidadeIds).order('nome')
      : { data: [] as { id: string; nome: string }[] },
    // Todas as unidades da empresa — para o seletor de destino
    // (usuário restrito pode enviar para qualquer unidade, não só as suas)
    empresaIdFinal
      ? supabaseAdmin.from('unidade').select('id, nome').eq('empresa_id', empresaIdFinal).eq('ativo', true).order('nome')
      : { data: [] as { id: string; nome: string }[] },
    empresaIdFinal
      ? supabaseAdmin.from('produto').select('id, nome').eq('empresa_id', empresaIdFinal).eq('ativo', true).order('nome')
      : { data: [] as { id: string; nome: string }[] },
  ])

  const todasUnidades    = (todasResult.data ?? [])       as { id: string; nome: string }[]
  const unidadesDestino  = (todasEmpresaResult.data ?? []) as { id: string; nome: string }[]
  const produtos         = (produtosResult.data ?? [])     as { id: string; nome: string }[]

  // Origem padrão = unidade do cookie (se ainda estiver na lista)
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

      {todasUnidades.length === 0 && (
        <div className="mb-5 bg-amber-500/8 border border-amber-500/25 text-amber-400 rounded-lg px-4 py-3 text-sm">
          Selecione uma unidade de origem no seletor acima e recarregue a página.
        </div>
      )}

      <NovaTransferenciaForm
        minhaUnidade={minhaUnidade}
        origemViaVinculo={false}
        todasUnidades={todasUnidades}
        unidadesDestino={unidadesDestino}
        produtos={produtos}
        empresaId={empresaIdFinal}
      />
    </div>
  )
}
