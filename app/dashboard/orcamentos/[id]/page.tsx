import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getOrcamento } from '@/app/actions/orcamento'
import { OrcamentoView } from './orcamento-view'

export default async function OrcamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await getOrcamento(id)
  if (res.error || !res.data) notFound()

  return (
    <div>
      <Link href="/dashboard/orcamentos" className="inline-flex items-center gap-1.5 text-secondary hover:text-accent-primary text-sm mb-6 transition-all hover:-translate-x-0.5">
        <ArrowLeft size={15} />
        Orçamentos
      </Link>
      <OrcamentoView orcamento={res.data} />
    </div>
  )
}
