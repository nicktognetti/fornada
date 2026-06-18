import { ArrowLeft, ArrowLeftRight } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { NovaTransferenciaForm } from '../components/nova-transferencia-form'
import { getUnidadesDoUsuario } from '@/app/actions/transferencia'

export default async function NovaTransferenciaPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: ue } = await supabase
    .from('usuario_empresa')
    .select('empresa_id')
    .eq('usuario_id', user?.id ?? '')
    .single()

  const empresaId = ue?.empresa_id ?? ''

  const { data: produtos } = await supabase
    .from('produto')
    .select('id, nome')
    .eq('empresa_id', empresaId)
    .eq('ativo', true)
    .order('nome')

  // Buscar unidades e determinar a unidade do usuário via server action
  let unidades: Array<{ id: string; nome: string }> = []
  let unidadeUsuarioId: string | null = null
  let fetchError: string | null = null

  try {
    const result = await getUnidadesDoUsuario()
    unidades = result.unidades
    unidadeUsuarioId = result.unidadeUsuarioId
  } catch {
    fetchError = 'Não foi possível carregar as unidades. Os campos ficaram livres para seleção.'
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/dashboard/transferencias"
          className="inline-flex items-center gap-1.5 text-sm text-[#888888] hover:text-[#d98d5f] transition-colors"
        >
          <ArrowLeft size={15} />
          Transferências
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <ArrowLeftRight size={22} className="text-[#d98d5f] shrink-0" />
        <div>
          <h1 className="text-2xl font-semibold text-[#f5f5f0]">Nova transferência</h1>
          <p className="text-sm text-[#888888] mt-0.5">Enviar produtos para outra unidade</p>
        </div>
      </div>

      {fetchError && (
        <div className="mb-5 bg-[#2a1e1e] border border-[#c74a4a]/30 text-[#c74a4a] rounded-lg px-4 py-3 text-sm">
          {fetchError}
        </div>
      )}

      <NovaTransferenciaForm
        unidades={unidades}
        produtos={produtos ?? []}
        empresaId={empresaId}
        unidadeUsuarioId={unidadeUsuarioId}
      />
    </div>
  )
}
