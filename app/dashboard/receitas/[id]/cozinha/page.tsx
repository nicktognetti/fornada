import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { getReceitaComposicao } from '../../composicao'
import { CozinhaView } from './cozinha-view'
import type { Receita } from '../../types'

interface Props {
  params: Promise<{ id: string }>
}

// Modo Cozinha: tela limpa para seguir a receita na bancada.
// SEM custo em lugar nenhum — feita para a confeitaria, não para o financeiro.
export default async function CozinhaPage({ params }: Props) {
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
      voltarHref={`/dashboard/receitas/${id}`}
      voltarLabel="Voltar à ficha"
    />
  )
}
