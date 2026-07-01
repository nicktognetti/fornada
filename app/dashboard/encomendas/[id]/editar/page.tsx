import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getEncomenda } from '@/app/actions/encomenda'
import { getProdutosParaOrcamento } from '@/app/actions/orcamento'
import { getClientes } from '@/app/actions/cliente'
import { EncomendaBuilder, type EncomendaEdicao } from '../../nova/encomenda-builder'

export default async function EditarEncomendaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [encRes, produtos, clientes] = await Promise.all([
    getEncomenda(id), getProdutosParaOrcamento(), getClientes(),
  ])
  const e = encRes.data
  if (!e) notFound()
  // Sem nível admin não enxerga valores — editar zeraria os preços. Volta pra visualização.
  if (!e.podeVerValores) redirect(`/dashboard/encomendas/${id}`)

  const edicao: EncomendaEdicao = {
    id: e.id,
    cliente_nome: e.cliente_nome,
    cliente_contato: e.cliente_contato,
    data_entrega: e.data_entrega,
    hora_entrega: e.hora_entrega,
    rastrear_status: e.rastrear_status,
    observacao: e.observacao,
    itens: e.itens.map((it) => ({
      produto_id: it.produto_id,
      descricao: it.descricao,
      quantidade: it.quantidade,
      preco_unitario: it.preco_unitario,
      observacao: it.observacao,
    })),
  }

  return (
    <div>
      <Link href={`/dashboard/encomendas/${e.id}`} className="inline-flex items-center gap-1.5 text-secondary hover:text-accent-primary text-sm mb-6 transition-all hover:-translate-x-0.5">
        <ArrowLeft size={15} />
        Voltar à encomenda
      </Link>
      <EncomendaBuilder produtos={produtos} clientes={clientes} edicao={edicao} />
    </div>
  )
}
