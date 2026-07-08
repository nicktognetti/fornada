import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { getReceitaComposicao } from '@/app/dashboard/receitas/composicao'
import { temAcesso } from '@/app/lib/authz'
import { CadernoReceita } from '../components/caderno-receita'
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
  const ingredientes = composicao.itens.map((i) => ({
    id: i.id,
    nome: i.nome_display,
    quantidade: i.quantidade,
    unidade: i.unidade,
  }))

  // Pode editar o modo de fazer quem tem escrita em caderno OU fichas técnicas nesta loja.
  const podeEditar = user
    ? await temAcesso(user.id, ['receitas', 'caderno'], { unidadeId: receita.unidade_id, nivel: 'escrita' })
    : false

  return <CadernoReceita receita={receita} ingredientes={ingredientes} podeEditar={podeEditar} />
}
