import { LayoutDashboard } from 'lucide-react'

export default function ResumPage() {
  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <LayoutDashboard size={20} className="text-croissant" />
        <h1 className="font-playfair text-creme text-2xl">Resumo</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { label: 'Insumos cadastrados', value: '—' },
          { label: 'Fichas de receita', value: '—' },
          { label: 'Produtos ativos', value: '—' },
          { label: 'Faturamento estimado', value: '—' },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-[#1e1e26] rounded-xl p-5 border border-white/5"
          >
            <p className="text-demerara text-xs uppercase tracking-wider mb-2">
              {card.label}
            </p>
            <p className="text-creme font-playfair text-3xl">{card.value}</p>
          </div>
        ))}
      </div>

      <p className="text-demerara/50 text-xs mt-6">
        Os dados aparecerão conforme você cadastrar insumos, fichas e preços.
      </p>
    </div>
  )
}
