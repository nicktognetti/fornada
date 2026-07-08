import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { getReceitaComposicao } from '@/app/dashboard/receitas/composicao'
import { CozinhaView } from '@/app/dashboard/receitas/[id]/cozinha/cozinha-view'
import type { Receita } from '@/app/dashboard/receitas/types'

interface Props {
  params: Promise<{ id: string }>
}

// Modo Cozinha do Caderno: checklist para seguir na bancada. Sem custo.
export default async function CadernoCozinhaPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [receitaRes, composicao] = await Promise.all([
    supabase.from('receita').select('*').eq('id', id).single(),
    getReceitaComposicao(id),
  ])

  if (receitaRes.error || !receitaRes.data) notFound()

  const receita = receitaRes.data as Receita
  const ingredientes = composicao.itens.map((i) => ({
    id: i.id,
    nome: i.nome_display,
    quantidade: i.quantidade,
    unidade: i.unidade,
  }))

  return (
    <CozinhaView
      receita={receita}
      ingredientes={ingredientes}
      voltarHref={`/dashboard/caderno/${id}`}
      voltarLabel="Voltar à receita"
    />
  )
}
