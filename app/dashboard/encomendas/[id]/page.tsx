import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getEncomenda } from '@/app/actions/encomenda'
import { EncomendaView } from './encomenda-view'

export default async function EncomendaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await getEncomenda(id)
  if (res.error || !res.data) notFound()

  return (
    <div>
      <Link href="/dashboard/encomendas" className="inline-flex items-center gap-1.5 text-secondary hover:text-accent-primary text-sm mb-6 transition-all hover:-translate-x-0.5">
        <ArrowLeft size={15} />
        Encomendas
      </Link>
      <EncomendaView encomenda={res.data} />
    </div>
  )
}
