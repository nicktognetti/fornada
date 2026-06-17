import { Tag, Construction } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { createClient } from '@/lib/supabase/server'

export default async function PrecosPage() {
  const supabase = await createClient()
  const { count } = await supabase
    .from('produto')
    .select('*', { count: 'exact', head: true })
    .eq('ativo', true)

  const total = count ?? 0

  return (
    <div className="max-w-2xl">
      <PageTitle icon={Tag} subtitle="Precificação de produtos">
        Preços
      </PageTitle>

      <div className="card-surface p-8 flex flex-col items-center text-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-[#d68a57]/10 flex items-center justify-center">
          <Construction size={28} className="text-[#d68a57]" />
        </div>
        <div>
          <p className="text-[#e8e6e3] font-playfair text-xl font-semibold mb-2">Em configuração</p>
          <p className="text-[#9e9e9e] text-sm max-w-xs">
            A tela de precificação mostrará produtos com markup, preço sugerido
            e decomposição de custo. O banco registra{' '}
            <span className="text-[#d68a57] font-semibold">{total} produto{total !== 1 ? 's' : ''}</span>{' '}
            {total === 0 ? 'ainda sem configuração de preço.' : 'cadastrados — aguardando configuração de markup.'}
          </p>
        </div>
        <div className="bg-[#1e1e22] rounded-xl p-4 border border-[rgba(255,255,255,0.05)] w-full text-left mt-2">
          <p className="text-[#9e9e9e]/60 text-[10px] uppercase tracking-wider mb-1">O que estará aqui</p>
          <ul className="text-[#9e9e9e] text-sm space-y-1 mt-2">
            <li>• Preço praticado vs. preço sugerido por markup</li>
            <li>• Status: PREJUÍZO / PREÇO BOM por produto</li>
            <li>• Decomposição do preço em custo + impostos + lucro</li>
            <li>• Exportação de cardápio</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
