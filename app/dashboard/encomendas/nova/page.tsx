import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getProdutosParaOrcamento, getOrcamento } from '@/app/actions/orcamento'
import { getClientes } from '@/app/actions/cliente'
import { getConfigAction } from '@/app/actions/config'
import { LOCAIS_CONFIG_KEY, LOCAIS_PADRAO } from '@/app/lib/locais'
import { EncomendaBuilder, type EncomendaDeOrcamento } from './encomenda-builder'

export default async function NovaEncomendaPage({
  searchParams,
}: {
  searchParams: Promise<{ orcamento?: string }>
}) {
  const { orcamento: orcamentoId } = await searchParams

  const [produtos, clientes, locaisRes, orcRes] = await Promise.all([
    getProdutosParaOrcamento(),
    getClientes(),
    getConfigAction<string[]>(LOCAIS_CONFIG_KEY),
    // A RLS por loja filtra: orçamento de outra loja simplesmente não vem,
    // e a tela cai no fluxo normal de encomenda em branco.
    orcamentoId ? getOrcamento(orcamentoId) : Promise.resolve({ data: undefined }),
  ])
  const locais = locaisRes.data ?? LOCAIS_PADRAO

  const o = orcRes.data
  const origem: EncomendaDeOrcamento | undefined = o
    ? {
        orcamento_id: o.id,
        numero: o.numero,
        cliente_nome: o.cliente_nome,
        cliente_contato: o.cliente_contato,
        observacao: o.observacao,
        itens: o.itens.map((it) => ({
          produto_id: it.produto_id,
          descricao: it.descricao,
          quantidade: it.quantidade,
          preco_unitario: it.preco_unitario,
        })),
      }
    : undefined

  const voltarHref = origem ? `/dashboard/orcamentos/${origem.orcamento_id}` : '/dashboard/encomendas'
  const voltarLabel = origem ? `Orçamento Nº ${origem.numero}` : 'Encomendas'

  return (
    <div>
      <Link href={voltarHref} className="inline-flex items-center gap-1.5 text-secondary hover:text-accent-primary text-sm mb-6 transition-all hover:-translate-x-0.5">
        <ArrowLeft size={15} />
        {voltarLabel}
      </Link>
      <EncomendaBuilder produtos={produtos} clientes={clientes} locais={locais} origem={origem} />
    </div>
  )
}
