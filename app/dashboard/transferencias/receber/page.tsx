import { createClient } from '@/lib/supabase/server'
import { getUnidadePreferida } from '@/app/actions/unidade'
import { temAcesso } from '@/app/lib/authz'
import { ReceberHub } from './components/receber-hub'
import type { TransferenciaReceber, Compra, StatusFinanceiro } from './types'

export default async function ReceberPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const isAdmin = user ? await temAcesso(user.id, ['transferencias'], { nivel: 'admin' }) : false

  // Empresa do usuário
  const { data: ue } = await supabase
    .from('usuario_empresa')
    .select('empresa_id')
    .eq('user_id', user?.id ?? '')
    .maybeSingle()
  const empresaId = ue?.empresa_id

  // Unidade selecionada pelo usuário (cookie) — respeita o tab ativo
  const minhaUnidadeId = await getUnidadePreferida()

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
      .from('transferencia')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('unidade_destino_id', minhaUnidadeId)
      .in('status_financeiro', ['pendente', 'a_receber'])
      .in('status', ['PENDENTE', 'EM_TRANSITO'])
      .order('created_at', { ascending: true })

    if (tList && tList.length > 0) {
      const ids = tList.map((t: { id: string }) => t.id)

      // Itens: contagem + produto_id para nomes
      const { data: itemRows } = await supabase
        .from('transferencia_item')
        .select('transferencia_id, produto_id')
        .in('transferencia_id', ids)

      const countMap = new Map<string, number>()
      const prodIdsPorTransf = new Map<string, string[]>()
      for (const r of (itemRows ?? []) as { transferencia_id: string; produto_id: string }[]) {
        countMap.set(r.transferencia_id, (countMap.get(r.transferencia_id) ?? 0) + 1)
        const arr = prodIdsPorTransf.get(r.transferencia_id) ?? []
        arr.push(r.produto_id)
        prodIdsPorTransf.set(r.transferencia_id, arr)
      }

      // Nomes dos produtos
      const allProdIds = [...new Set((itemRows ?? []).map((i: { produto_id: string }) => i.produto_id))]
      const { data: prodRows } = allProdIds.length > 0
        ? await supabase.from('produto').select('id, nome').in('id', allProdIds)
        : { data: [] }
      const prodMap = new Map((prodRows ?? []).map((p: { id: string; nome: string }) => [p.id, p.nome]))

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
        produtos:            (prodIdsPorTransf.get(t.id) ?? []).map((id) => prodMap.get(id) ?? '').filter(Boolean),
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
      userId={user?.id ?? ''}
      totalAReceber={totalAReceber}
      isCentro={isCentro}
      isAdmin={isAdmin}
    />
  )
}
