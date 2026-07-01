import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getProdutosParaOrcamento } from '@/app/actions/orcamento'
import { getClientes } from '@/app/actions/cliente'
import { OrcamentoBuilder } from './orcamento-builder'

export default async function NovoOrcamentoPage() {
  const [produtos, clientes] = await Promise.all([getProdutosParaOrcamento(), getClientes()])
  return (
    <div>
      <Link href="/dashboard/orcamentos" className="inline-flex items-center gap-1.5 text-secondary hover:text-accent-primary text-sm mb-6 transition-all hover:-translate-x-0.5">
        <ArrowLeft size={15} />
        Orçamentos
      </Link>
      <OrcamentoBuilder produtos={produtos} clientes={clientes} />
    </div>
  )
}
