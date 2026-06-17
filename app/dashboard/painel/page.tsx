import { BarChart3, Construction } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'

export default function PainelPage() {
  return (
    <div className="max-w-2xl">
      <PageTitle icon={BarChart3} subtitle="Indicadores financeiros da padaria">
        Painel Financeiro
      </PageTitle>

      <div className="card-surface p-8 flex flex-col items-center text-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-[#d68a57]/10 flex items-center justify-center">
          <Construction size={28} className="text-[#d68a57]" />
        </div>
        <div>
          <p className="text-[#e8e6e3] font-playfair text-xl font-semibold mb-2">Em configuração</p>
          <p className="text-[#9e9e9e] text-sm max-w-xs">
            O painel financeiro exibirá ponto de equilíbrio, margem média,
            markup por linha e despesas fixas assim que as configurações
            da empresa forem preenchidas.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 w-full mt-2">
          {['DESPESA FIXA / MÊS', 'FATURAMENTO PREVISTO', 'MARGEM MÉDIA', 'PONTO DE EQUILÍBRIO'].map(label => (
            <div key={label} className="bg-[#1e1e22] rounded-xl p-4 border border-[rgba(255,255,255,0.05)]">
              <p className="text-[#9e9e9e]/60 text-[10px] uppercase tracking-wider mb-2">{label}</p>
              <p className="text-[#9e9e9e]/30 font-playfair text-2xl font-bold">—</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
