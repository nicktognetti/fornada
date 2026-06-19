import { createClient } from '@/lib/supabase/server'
import { ReceberHub } from './components/receber-hub'
import type { TransferenciaReceber, Compra, StatusFinanceiro } from './types'

export default async function ReceberPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Empresa do usuário
  const { data: ue } = await supabase
    .from('usuario_empresa')
    .select('empresa_id')
    .eq('usuario_id', user?.id ?? '')
    .single()
  const empresaId = ue?.empresa_id

  // Unidade do usuário (via fornada.usuario_unidade)
  const { data: vinculo } = await supabase
    .schema('fornada')
    .from('usuario_unidade')
    .select('unidade_id')
    .eq('user_id', user?.id ?? '')
    .order('created_at')
    .limit(1)
    .single()
  const minhaUnidadeId = vinculo?.unidade_id ?? null

  // Todas as unidades da empresa para montar nomes
  const { data: unidades } = await supabase
    .from('unidade')
    .select('id, nome')
    .eq('empresa_id', empresaId ?? '')
  const unidadeMap = new Map((unidades ?? []).map((u) => [u.id, u.nome]))

  // Detectar se é "Centro" (a unidade que paga) — qualquer unidade com "centro" no nome
  const minhaUnidadeNome = minhaUnidadeId ? (unidadeMap.get(minhaUnidadeId) ?? '') : ''
  const isCentro = minhaUnidadeNome.toLowerCase().includes('centro')

  // Transferências com status_financeiro = 'a_receber' destinadas à unidade do usuário
  let transferencias: TransferenciaReceber[] = []
  if (empresaId && minhaUnidadeId) {
    const { data: tList } = await supabase
      .schema('fornada')
      .from('transferencia')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('unidade_destino_id', minhaUnidadeId)
      .in('status_financeiro', ['pendente', 'a_receber'])
      .order('created_at', { ascending: true })

    if (tList && tList.length > 0) {
      // Contar itens por transferência
      const ids = tList.map((t: { id: string }) => t.id)
      const { data: itemRows } = await supabase
        .schema('fornada')
        .from('transferencia_item')
        .select('transferencia_id')
        .in('transferencia_id', ids)

      const countMap = new Map<string, number>()
      for (const r of (itemRows ?? []) as { transferencia_id: string }[]) {
        countMap.set(r.transferencia_id, (countMap.get(r.transferencia_id) ?? 0) + 1)
      }

      type TRec = {
        id: string; codigo: string; tipo: 'TRANSFERENCIA' | 'DEVOLUCAO'; status: string
        status_financeiro: StatusFinanceiro | null; valor_total: number | null
        unidade_origem_id: string; unidade_destino_id: string; created_at: string
      }
      transferencias = (tList as TRec[]).map((t) => ({
        id:                  t.id,
        codigo:              t.codigo,
        tipo:                t.tipo,
        status:              t.status,
        status_financeiro:   t.status_financeiro ?? 'pendente',
        valor_total:         t.valor_total ?? 0,
        unidade_origem_id:   t.unidade_origem_id,
        unidade_origem_nome: unidadeMap.get(t.unidade_origem_id) ?? '—',
        unidade_destino_id:  t.unidade_destino_id,
        total_itens:         countMap.get(t.id) ?? 0,
        created_at:          t.created_at,
      }))
    }
  }

  // Soma total a receber (só transferências com status_financeiro = 'a_receber')
  const totalAReceber = transferencias
    .filter((t) => t.status_financeiro === 'a_receber')
    .reduce((acc, t) => acc + t.valor_total, 0)

  // Compras desta unidade
  let compras: Compra[] = []
  if (minhaUnidadeId) {
    const { data: compraRows } = await supabase
      .from('compra')
      .select('*')
      .eq('unidade_id', minhaUnidadeId)
      .order('data_compra', { ascending: false })
      .limit(50)
    compras = (compraRows ?? []) as Compra[]
  }

  return (
    <ReceberHub
      transferencias={transferencias}
      compras={compras}
      unidadeId={minhaUnidadeId ?? ''}
      totalAReceber={totalAReceber}
      isCentro={isCentro}
    />
  )
}
