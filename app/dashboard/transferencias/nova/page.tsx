import { ArrowLeft, ArrowLeftRight } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NovaTransferenciaForm } from '../components/nova-transferencia-form'
import { getUserUnidadeAction } from '@/app/actions/transferencia'
import { getUnidadePreferida } from '@/app/actions/unidade'

export default async function NovaTransferenciaPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Usa admin para bypas RLS: usuario_empresa e unidade podem ter políticas
  // que bloqueiam usuários não-admin dependendo de migrations aplicadas no banco.
  const { data: ue } = await supabaseAdmin
    .from('usuario_empresa')
    .select('empresa_id')
    .eq('user_id', user?.id ?? '')
    .maybeSingle()

  const empresaId = ue?.empresa_id ?? ''

  // Todas as unidades da empresa + produtos + cookie em paralelo
  const [unidadesResult, produtosResult, unidadeCookieId] = await Promise.all([
    supabaseAdmin.from('unidade').select('id, nome').eq('empresa_id', empresaId).order('created_at'),
    supabaseAdmin.from('produto').select('id, nome').eq('empresa_id', empresaId).eq('ativo', true).order('nome'),
    getUnidadePreferida(),
  ])

  const todasUnidades = unidadesResult.data ?? []
  const produtos = produtosResult.data ?? []

  // 1ª fonte: RPC fn_get_user_unidade (vínculo fixo do operador)
  let minhaUnidade: { id: string; nome: string } | null = null

  const unidadeResult = await getUserUnidadeAction()
  if (unidadeResult.success) {
    const encontrada = todasUnidades.find((u) => u.id === unidadeResult.unidade.id)
    minhaUnidade = encontrada ?? null
  }

  // 2ª fonte (fallback): cookie unidade_preferida do UnidadeSelector
  if (!minhaUnidade && unidadeCookieId) {
    const encontrada = todasUnidades.find((u) => u.id === unidadeCookieId)
    minhaUnidade = encontrada ?? null
  }

  // Só exibe alerta se não há qualquer referência de unidade
  const semUnidade = !minhaUnidade && todasUnidades.length >= 2

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/dashboard/transferencias"
          className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-accent-primary transition-colors"
        >
          <ArrowLeft size={15} />
          Transferências
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <ArrowLeftRight size={22} className="text-accent-primary shrink-0" />
        <div>
          <h1 className="text-2xl font-semibold text-primary">Nova transferência</h1>
          <p className="text-sm text-secondary mt-0.5">Enviar produtos para outra unidade</p>
        </div>
      </div>

      {/* Banner de aviso: só quando não há unidade de origem identificada */}
      {semUnidade && (
        <div className="mb-5 bg-amber-500/8 border border-amber-500/25 text-amber-400 rounded-lg px-4 py-3 text-sm">
          Selecione a unidade de origem e destino para continuar.
        </div>
      )}

      <NovaTransferenciaForm
        minhaUnidade={minhaUnidade}
        origemViaVinculo={unidadeResult.success}
        todasUnidades={todasUnidades}
        produtos={produtos}
        empresaId={empresaId}
      />
    </div>
  )
}
