import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getOrcamento, getProdutosParaOrcamento } from '@/app/actions/orcamento'
import { getClientes } from '@/app/actions/cliente'
import { OrcamentoBuilder, type OrcamentoEdicao } from '../../novo/orcamento-builder'

export default async function EditarOrcamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [orcRes, produtos, clientes] = await Promise.all([
    getOrcamento(id), getProdutosParaOrcamento(), getClientes(),
  ])
  const o = orcRes.data
  if (!o) notFound()

  const edicao: OrcamentoEdicao = {
    id: o.id,
    cliente_nome: o.cliente_nome,
    cliente_contato: o.cliente_contato,
    validade_dias: o.validade_dias,
    observacao: o.observacao,
    itens: o.itens.map((it) => ({
      produto_id: it.produto_id,
      descricao: it.descricao,
      quantidade: it.quantidade,
      preco_unitario: it.preco_unitario,
    })),
  }

  return (
    <div>
      <Link href={`/dashboard/orcamentos/${o.id}`} className="inline-flex items-center gap-1.5 text-secondary hover:text-accent-primary text-sm mb-6 transition-all hover:-translate-x-0.5">
        <ArrowLeft size={15} />
        Voltar ao orçamento
      </Link>
      <OrcamentoBuilder produtos={produtos} clientes={clientes} edicao={edicao} />
    </div>
  )
}
