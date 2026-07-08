import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { getReceitaComposicao } from '@/app/dashboard/receitas/composicao'
import { temAcesso } from '@/app/lib/authz'
import { CadernoReceitaView, type ItemCaderno } from '../components/caderno-receita-view'
import type { Receita } from '@/app/dashboard/receitas/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function CadernoReceitaPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [receitaRes, composicao, { data: { user } }] = await Promise.all([
    supabase.from('receita').select('*').eq('id', id).single(),
    getReceitaComposicao(id),
    supabase.auth.getUser(),
  ])

  if (receitaRes.error || !receitaRes.data) notFound()

  const receita = receitaRes.data as Receita
  // Cost-free: nunca mandamos custo pro cliente do Caderno.
  const itens: ItemCaderno[] = composicao.itens.map((i) => ({
    id: i.id,
    insumo_id: i.insumo_id,
    sub_receita_id: i.sub_receita_id,
    quantidade: i.quantidade,
    nome: i.nome_display,
    unidade: i.unidade,
    is_pendente: i.is_pendente,
  }))

  const podeEditar = user
    ? await temAcesso(user.id, ['receitas', 'caderno'], { unidadeId: receita.unidade_id, nivel: 'escrita' })
    : false

  return <CadernoReceitaView receita={receita} itens={itens} podeEditar={podeEditar} />
}
