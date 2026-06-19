import { ArrowLeft, ArrowLeftRight } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { NovaTransferenciaForm } from '../components/nova-transferencia-form'
import { getUserUnidadeAction } from '@/app/actions/transferencia'

export default async function NovaTransferenciaPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: ue } = await supabase
    .from('usuario_empresa')
    .select('empresa_id')
    .eq('usuario_id', user?.id ?? '')
    .single()

  const empresaId = ue?.empresa_id ?? ''

  // Todas as unidades da empresa + produtos em paralelo
  const [unidadesResult, produtosResult] = await Promise.all([
    supabase.from('unidade').select('id, nome').eq('empresa_id', empresaId).order('nome'),
    supabase.from('produto').select('id, nome').eq('empresa_id', empresaId).eq('ativo', true).order('nome'),
  ])

  const todasUnidades = unidadesResult.data ?? []
  const produtos = produtosResult.data ?? []

  // Buscar a unidade do usuário via tabela fornada.usuario_unidade
  let minhaUnidade: { id: string; nome: string } | null = null
  let fetchError: string | null = null

  const unidadeResult = await getUserUnidadeAction()
  if (unidadeResult.success) {
    // Confirma que a unidade retornada pertence à empresa atual
    const encontrada = todasUnidades.find((u) => u.id === unidadeResult.unidade.id)
    minhaUnidade = encontrada ?? null
  } else {
    fetchError = unidadeResult.error
  }

  // Unidades possíveis de destino = todas exceto a do usuário
  const unidadesDestino = minhaUnidade
    ? todasUnidades.filter((u) => u.id !== minhaUnidade!.id)
    : todasUnidades

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

      {/* Banner de aviso quando vínculo não encontrado */}
      {fetchError && (
        <div className="mb-5 bg-danger-tint border border-danger/30 text-danger rounded-lg px-4 py-3 text-sm">
          Unidade não configurada: selecione origem e destino manualmente.
        </div>
      )}

      <NovaTransferenciaForm
        minhaUnidade={minhaUnidade}
        unidadesDestino={unidadesDestino}
        produtos={produtos}
        empresaId={empresaId}
      />
    </div>
  )
}
