import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getProdutosParaOrcamento } from '@/app/actions/orcamento'
import { getClientes } from '@/app/actions/cliente'
import { getConfigAction } from '@/app/actions/config'
import { LOCAIS_CONFIG_KEY, LOCAIS_PADRAO } from '@/app/lib/locais'
import { EncomendaBuilder } from './encomenda-builder'

export default async function NovaEncomendaPage() {
  const [produtos, clientes, locaisRes] = await Promise.all([getProdutosParaOrcamento(), getClientes(), getConfigAction<string[]>(LOCAIS_CONFIG_KEY)])
  const locais = locaisRes.data ?? LOCAIS_PADRAO
  return (
    <div>
      <Link href="/dashboard/encomendas" className="inline-flex items-center gap-1.5 text-secondary hover:text-accent-primary text-sm mb-6 transition-all hover:-translate-x-0.5">
        <ArrowLeft size={15} />
        Encomendas
      </Link>
      <EncomendaBuilder produtos={produtos} clientes={clientes} locais={locais} />
    </div>
  )
}
