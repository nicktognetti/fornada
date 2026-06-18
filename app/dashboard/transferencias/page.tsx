import { ArrowLeftRight, Plus } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageTitle } from '@/app/components/ui/page-title'
import { TransferenciaTable } from './components/transferencia-table'
import type { TransferenciaRow } from './components/transferencia-table'

export default async function TransferenciasPage({
  searchParams,
}: {
  searchParams: Promise<{ criado?: string }>
}) {
  const { criado } = await searchParams
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

  const empresaId = ue?.empresa_id

  // Transferências (schema fornada)
  const { data: transferencias } = empresaId
    ? await supabase
        .schema('fornada')
        .from('transferencia')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })
        .limit(50)
    : { data: [] }

  // Nomes das unidades (schema public)
  const { data: unidades } = await supabase.from('unidade').select('id, nome')
  const unidadeMap = new Map((unidades ?? []).map((u) => [u.id, u.nome]))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: TransferenciaRow[] = (transferencias ?? []).map((t: any) => ({
    id: t.id,
    codigo: t.codigo,
    tipo: t.tipo,
    status: t.status,
    unidade_origem_nome: unidadeMap.get(t.unidade_origem_id) ?? '—',
    unidade_destino_nome: unidadeMap.get(t.unidade_destino_id) ?? '—',
    responsavel_email: t.responsavel_origem_id === user?.id ? 'Você' : 'Outro operador',
    created_at: t.created_at,
  }))

  return (
    <div>
      <div className="flex items-start justify-between mb-8 gap-4">
        <PageTitle icon={ArrowLeftRight} subtitle="Movimentações entre unidades">
          Transferências
        </PageTitle>
        <Link
          href="/dashboard/transferencias/nova"
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-marrom-500 text-creme-100 text-sm font-medium hover:bg-marrom-600 shadow-sm transition-colors shrink-0 mt-1"
        >
          <Plus size={15} />
          Nova transferência
        </Link>
      </div>

      <TransferenciaTable rows={rows} sucesso={criado ?? null} />
    </div>
  )
}
