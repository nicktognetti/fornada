import { Tag, ShoppingBag, BookOpen, AlertTriangle } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { SectionLabel } from '@/app/components/ui/section-label'
import { createClient } from '@/lib/supabase/server'
import { formatBRL } from '@/lib/format'
import Link from 'next/link'

export default async function PrecosPage({
  searchParams,
}: {
  searchParams: Promise<{ unidade?: string }>
}) {
  const { unidade: unidadeId } = await searchParams
  const supabase = await createClient()

  let produtosQuery = supabase.from('produto').select('id, nome, tipo, ativo, receita_id').eq('ativo', true).order('nome')
  if (unidadeId) produtosQuery = produtosQuery.eq('unidade_id', unidadeId)

  const [produtosRes, custosRes, precosRes] = await Promise.all([
    produtosQuery,
    supabase.from('vw_custo_receita').select('id, custo_unitario, rendimento_unidade'),
    supabase.from('produto_preco').select('produto_id, preco_praticado').order('produto_id'),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const produtos: any[] = produtosRes.data ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const custoMap = new Map((custosRes.data ?? []).map((c: any) => [c.id, c]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const precoMap = new Map((precosRes.data ?? []).map((p: any) => [p.produto_id, p.preco_praticado as number | null]))

  const comReceita = produtos.filter((p) => p.receita_id && custoMap.has(p.receita_id))
  const semReceita = produtos.filter((p) => !p.receita_id || !custoMap.has(p.receita_id))

  if (produtos.length === 0) {
    return (
      <div className="max-w-3xl">
        <PageTitle icon={Tag} subtitle="Precificação de produtos">
          Preços
        </PageTitle>
        <div className="card-surface p-8 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-accent-primary/10 flex items-center justify-center">
            <ShoppingBag size={28} className="text-accent-primary" />
          </div>
          <div>
            <p className="text-primary font-playfair text-xl font-semibold mb-2">Nenhum produto cadastrado</p>
            <p className="text-secondary text-sm max-w-xs">
              Produtos vinculados a fichas técnicas aparecerão aqui com custo de produção
              e comparativo de preço praticado.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <PageTitle icon={Tag} subtitle="Precificação de produtos">
        Preços
      </PageTitle>

      {comReceita.length > 0 && (
        <div className="space-y-3 mb-8">
          <SectionLabel icon={BookOpen}>Com ficha técnica</SectionLabel>
          <div className="space-y-2">
            {comReceita.map((produto) => {
              const custo = custoMap.get(produto.receita_id)
              const custoUnitario: number | null = custo?.custo_unitario ?? null
              const precoPraticado: number | null = precoMap.get(produto.id) ?? null
              const margem = custoUnitario && precoPraticado
                ? ((precoPraticado - custoUnitario) / precoPraticado) * 100
                : null
              const prejuizo = margem != null && margem < 0

              return (
                <div key={produto.id} className="card-surface px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-playfair text-primary text-[17px] font-semibold leading-tight truncate">
                      {produto.nome}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="text-secondary text-xs">
                        custo: {custoUnitario != null
                          ? `R$ ${formatBRL(custoUnitario)}/${custo?.rendimento_unidade ?? 'un'}`
                          : '—'}
                      </span>
                      {precoPraticado != null && (
                        <span className="text-secondary text-xs">
                          preço: <span className="text-primary">R$ {formatBRL(precoPraticado)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {margem != null ? (
                      <>
                        <p className={`font-playfair text-[22px] font-bold leading-none ${prejuizo ? 'text-red-400' : 'text-emerald-400'}`}>
                          {margem.toFixed(1)}%
                        </p>
                        <p className={`text-[11px] mt-0.5 ${prejuizo ? 'text-red-400/70' : 'text-emerald-400/70'}`}>
                          {prejuizo ? 'PREJUÍZO' : 'margem'}
                        </p>
                      </>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/25">
                        sem preço
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {semReceita.length > 0 && (
        <div className="space-y-3">
          <SectionLabel icon={AlertTriangle}>Sem ficha técnica</SectionLabel>
          <div className="space-y-2">
            {semReceita.map((produto) => (
              <div key={produto.id} className="card-surface px-5 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-playfair text-primary text-[17px] font-semibold leading-tight truncate">
                    {produto.nome}
                  </p>
                  <p className="text-secondary/60 text-xs mt-1">custo de produção não calculado</p>
                </div>
                <Link
                  href="/dashboard/receitas"
                  className="shrink-0 text-[11px] text-accent-primary hover:text-accent-primary/80 transition-colors"
                >
                  vincular ficha →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-secondary/40 text-xs mt-6 text-right">
        {produtos.length} produto{produtos.length !== 1 ? 's' : ''} cadastrado{produtos.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
