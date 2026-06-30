import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getProdutosParaOrcamento } from '@/app/actions/orcamento'
import { EncomendaBuilder } from './encomenda-builder'

export default async function NovaEncomendaPage() {
  const produtos = await getProdutosParaOrcamento()
  return (
    <div>
      <Link href="/dashboard/encomendas" className="inline-flex items-center gap-1.5 text-secondary hover:text-accent-primary text-sm mb-6 transition-all hover:-translate-x-0.5">
        <ArrowLeft size={15} />
        Encomendas
      </Link>
      <EncomendaBuilder produtos={produtos} />
    </div>
  )
}
