import { BarChart3 } from 'lucide-react'

export default function PainelPage() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 size={20} className="text-croissant" />
        <h1 className="font-playfair text-creme text-2xl">Painel Financeiro</h1>
      </div>
      <p className="text-demerara">Em construção.</p>
    </div>
  )
}
