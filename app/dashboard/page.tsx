import Link from 'next/link'
import { LayoutDashboard, Package, BookOpen, ShoppingBag, TrendingUp, ArrowRight } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { createClient } from '@/lib/supabase/server'

export default async function ResumePage() {
  const supabase = await createClient()

  const [insumoRes, receitaRes, produtoRes] = await Promise.all([
    supabase.from('insumo').select('*', { count: 'exact', head: true }).eq('ativo', true),
    supabase.from('receita').select('*', { count: 'exact', head: true }).eq('ativo', true),
    supabase.from('produto').select('*', { count: 'exact', head: true }).eq('ativo', true),
  ])

  const insumoCount = insumoRes.count ?? 0
  const receitaCount = receitaRes.count ?? 0
  const produtoCount = produtoRes.error ? null : (produtoRes.count ?? 0)

  const cards = [
    {
      label: 'INSUMOS CADASTRADOS',
      icon: Package,
      href: '/dashboard/insumos',
      valueStr: insumoCount.toString(),
      sub: 'matérias-primas com custo',
    },
    {
      label: 'FICHAS TÉCNICAS',
      icon: BookOpen,
      href: '/dashboard/receitas',
      valueStr: receitaCount.toString(),
      sub: 'receitas e sub-receitas',
    },
    {
      label: 'PRODUTOS ATIVOS',
      icon: ShoppingBag,
      href: '/dashboard/precos',
      valueStr: produtoCount != null ? produtoCount.toString() : null,
      sub: 'cadastrados para venda',
    },
    {
      label: 'PAINEL FINANCEIRO',
      icon: TrendingUp,
      href: '/dashboard/painel',
      valueStr: null,
      sub: null,
    },
  ]

  return (
    <div className="max-w-2xl">
      <PageTitle icon={LayoutDashboard} subtitle="Visão geral da padaria">
        Resumo
      </PageTitle>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.label}
              href={card.href}
              className="card-surface p-6 block group cursor-pointer hover:bg-[#2e2e32] hover:shadow-lg transition-all duration-150 relative"
            >
              <div className="flex items-center gap-2 mb-3">
                <Icon size={13} className="text-[#d68a57] shrink-0" />
                <p className="field-label">{card.label}</p>
              </div>
              {card.valueStr != null ? (
                <>
                  <p className="font-playfair text-[#d68a57] text-[36px] font-bold leading-none">
                    {card.valueStr}
                  </p>
                  {card.sub && (
                    <p className="text-[#9e9e9e] text-xs mt-2">{card.sub}</p>
                  )}
                </>
              ) : (
                <p className="font-outfit text-[#9e9e9e] text-lg font-medium">Em breve</p>
              )}
              <ArrowRight
                size={14}
                className="absolute bottom-5 right-5 text-[#9e9e9e]/30 opacity-0 group-hover:opacity-100 group-hover:text-[#d68a57] transition-all"
              />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
