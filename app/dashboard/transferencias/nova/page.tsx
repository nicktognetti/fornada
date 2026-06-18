import { ArrowLeft, ArrowLeftRight } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageTitle } from '@/app/components/ui/page-title'
import { NovaTransferenciaForm } from '../components/nova-transferencia-form'

export default async function NovaTransferenciaPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Empresa do usuário
  const { data: ue } = await supabase
    .from('usuario_empresa')
    .select('empresa_id')
    .eq('usuario_id', user?.id ?? '')
    .single()

  const empresaId = ue?.empresa_id ?? ''

  // Unidades da empresa
  const { data: unidades } = await supabase
    .from('unidade')
    .select('id, nome')
    .eq('empresa_id', empresaId)
    .order('nome')

  // Produtos ativos da empresa
  const { data: produtos } = await supabase
    .from('produto')
    .select('id, nome')
    .eq('empresa_id', empresaId)
    .eq('ativo', true)
    .order('nome')

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/dashboard/transferencias"
          className="inline-flex items-center gap-1.5 text-sm text-demerara hover:text-marrom-500 transition-colors mb-6"
        >
          <ArrowLeft size={15} />
          Transferências
        </Link>
      </div>

      <PageTitle icon={ArrowLeftRight} subtitle="Enviar produtos para outra unidade">
        Nova transferência
      </PageTitle>

      <NovaTransferenciaForm
        unidades={unidades ?? []}
        produtos={produtos ?? []}
        empresaId={empresaId}
      />
    </div>
  )
}
