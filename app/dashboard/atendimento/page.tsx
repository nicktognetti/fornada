import { MessageCircle } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { listarConversas } from '@/app/actions/atendimento'
import { getUnidadePreferida } from '@/app/actions/unidade'
import { AtendimentoView } from './components/atendimento-view'

export default async function AtendimentoPage() {
  const [res, unidadeId] = await Promise.all([listarConversas('todos'), getUnidadePreferida()])

  return (
    <div className="max-w-6xl">
      <PageTitle icon={MessageCircle} subtitle="Conversas do robô do WhatsApp — Encomendas e Delivery">
        Atendimento
      </PageTitle>

      {res.error ? (
        <p className="text-sm text-danger bg-danger-tint rounded-lg px-3 py-2">{res.error}</p>
      ) : (
        // key remonta a view inteira ao trocar de loja — sem isso, conversas,
        // pedidos e relatório continuavam mostrando a loja anterior
        <AtendimentoView key={unidadeId ?? 'todas'} conversasIniciais={res.data?.conversas ?? []} />
      )}
    </div>
  )
}
