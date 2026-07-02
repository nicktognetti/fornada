import { Tag, BookOpen, AlertTriangle } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { SectionLabel } from '@/app/components/ui/section-label'
import { formatBRL, formatCustoGrande } from '@/lib/format'
import { getPainelFinanceiro } from '@/app/actions/painel'
import { getUnidadePreferida } from '@/app/actions/unidade'
import { PrecosComPrecoList } from './components/precos-com-preco-list'
import Link from 'next/link'

export default async function PrecosPage() {
  const unidadeId = await getUnidadePreferida()
  const result = await getPainelFinanceiro(unidadeId ?? undefined)

  const todos = result.data?.fichas ?? []
  const comCusto    = todos.filter((p) => p.custo_total > 0)
  const semCusto    = todos.filter((p) => p.custo_total <= 0)
  const comPreco    = comCusto.filter((p) => p.preco_venda > 0)
  const semPreco    = comCusto.filter((p) => p.preco_venda <= 0)

  if (todos.length === 0) {
    return (
      <div className="max-w-3xl">
        <PageTitle icon={Tag} subtitle="Precificação de produtos">
          Preços
        </PageTitle>
        <div className="card-surface p-8 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-accent-primary/10 flex items-center justify-center">
            <Tag size={28} className="text-accent-primary" />
          </div>
          <div>
            <p className="text-primary font-playfair text-xl font-semibold mb-2">Nenhum produto com custo calculado</p>
            <p className="text-secondary text-sm max-w-xs">
              Cadastre fichas técnicas com insumos para ver o custo de produção e definir preços de venda.
            </p>
          </div>
          <Link href="/dashboard/receitas" className="btn-primary text-sm px-5 py-2">
            Ver Fichas Técnicas →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <PageTitle icon={Tag} subtitle="Precificação de produtos">
        Preços
      </PageTitle>

      {comPreco.length > 0 && (
        <div className="space-y-3 mb-8">
          <SectionLabel icon={BookOpen}>Com preço definido</SectionLabel>
          <PrecosComPrecoList produtos={comPreco} />
        </div>
      )}

      {semPreco.length > 0 && (
        <div className="space-y-3 mb-8">
          <SectionLabel icon={AlertTriangle}>Sem preço definido</SectionLabel>
          <div className="space-y-2">
            {semPreco.map((p) => (
              <div key={p.produto_id} className="card-surface px-5 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-playfair text-primary text-[17px] font-semibold leading-tight truncate">
                    {p.produto_nome}
                  </p>
                  <p className="text-secondary text-xs mt-1">
                    custo: {p.rendimento_unidade ? formatCustoGrande(p.custo_total, p.rendimento_unidade) : `R$ ${formatBRL(p.custo_total)}`} — sem preço de venda
                  </p>
                </div>
                <Link
                  href="/dashboard/painel"
                  className="shrink-0 text-[11px] text-accent-primary hover:text-accent-primary/80 transition-colors"
                >
                  definir preço →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {semCusto.length > 0 && (
        <div className="space-y-3">
          <SectionLabel icon={AlertTriangle}>Sem custo calculado</SectionLabel>
          <div className="space-y-2">
            {semCusto.map((p) => (
              <div key={p.produto_id} className="card-surface px-5 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-playfair text-primary text-[17px] font-semibold leading-tight truncate">
                    {p.produto_nome}
                  </p>
                  <p className="text-secondary/60 text-xs mt-1">
                    {p.produto_tipo === 'revenda' ? 'custo de compra não informado' : 'ficha técnica sem insumos'}
                  </p>
                </div>
                <Link
                  href={p.produto_tipo === 'revenda' ? '/dashboard/produtos' : '/dashboard/receitas'}
                  className="shrink-0 text-[11px] text-accent-primary hover:text-accent-primary/80 transition-colors"
                >
                  {p.produto_tipo === 'revenda' ? 'informar custo →' : 'ver ficha →'}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-secondary/40 text-xs mt-6 text-right">
        {todos.length} produto{todos.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
