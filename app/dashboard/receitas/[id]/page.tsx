import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FichaView } from '../components/ficha-view'
import { getReceitaComposicao } from '../composicao'
import type { Receita } from '../types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function FichaPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [receitaRes, composicao] = await Promise.all([
    supabase.from('receita').select('*').eq('id', id).single(),
    getReceitaComposicao(id),
  ])

  if (receitaRes.error || !receitaRes.data) notFound()

  const receita = receitaRes.data as Receita
  const { custo, itens } = composicao

  return (
    <div>
      <Link
        href="/dashboard/receitas"
        className="inline-flex items-center gap-1.5 text-secondary hover:text-accent-primary text-sm mb-6 transition-all hover:-translate-x-0.5"
      >
        <ArrowLeft size={15} />
        Fichas Técnicas
      </Link>

      <FichaView
        receita={receita}
        custo={custo ?? null}
        itens={itens}
      />
    </div>
  )
}
