import { Calculator } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'

export default function SimuladorPage() {
  return (
    <div className="max-w-2xl">
      <PageTitle icon={Calculator} subtitle="Simule cenários antes de decidir">
        Simulador
      </PageTitle>

      <div className="card-surface p-8 flex flex-col items-center text-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-marrom-500/10 flex items-center justify-center">
          <Calculator size={28} className="text-marrom-500" />
        </div>
        <div>
          <p className="text-madrugada-800 font-playfair text-xl font-semibold mb-2">Em breve</p>
          <p className="text-demerara text-sm max-w-xs">
            O simulador permitirá testar o impacto de alterações de preço de insumos
            nas suas fichas técnicas e no ponto de equilíbrio — antes de confirmar qualquer mudança.
          </p>
        </div>
        <div className="bg-creme-100 rounded-xl p-4 border border-marrom-500/8 w-full text-left mt-2">
          <p className="text-demerara/60 text-[10px] uppercase tracking-wider mb-1">Funcionalidades planejadas</p>
          <ul className="text-demerara text-sm space-y-1 mt-2">
            <li>• Simular alta/baixa de insumo e ver impacto no custo</li>
            <li>• Comparar cenários lado a lado</li>
            <li>• Calcular novo ponto de equilíbrio sem salvar</li>
            <li>• Sugerir reajuste de preço de venda</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
