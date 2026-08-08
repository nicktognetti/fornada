import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getPlanoProducao } from '@/app/actions/producao'
import { hojeBR } from '@/lib/format'
import { ProducaoView } from './producao-view'

export default async function PlanoProducaoPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>
}) {
  const { data } = await searchParams
  // Dia no fuso da padaria: o servidor roda em UTC e "hoje" viraria às 21h.
  const hoje = hojeBR()
  const alvo = /^\d{4}-\d{2}-\d{2}$/.test(data ?? '') ? data! : hoje

  const r = await getPlanoProducao(alvo)
  const plano = r.data ?? { data: alvo, grupos: [], totalEncomendas: 0, jaProntas: 0 }

  return (
    <div>
      <Link href="/dashboard/encomendas" className="inline-flex items-center gap-1.5 text-secondary hover:text-accent-primary text-sm mb-6 transition-all hover:-translate-x-0.5 print:hidden">
        <ArrowLeft size={15} />
        Encomendas
      </Link>
      {r.error && (
        <p className="text-sm text-danger bg-danger-tint rounded-lg px-3 py-2 mb-4">{r.error}</p>
      )}
      <ProducaoView inicial={plano} hoje={hoje} />
    </div>
  )
}
