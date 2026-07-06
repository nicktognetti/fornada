import { MessageCircle } from 'lucide-react'
import { PageTitle } from '@/app/components/ui/page-title'
import { listarConversas } from '@/app/actions/atendimento'
import { AtendimentoView } from './components/atendimento-view'

export default async function AtendimentoPage() {
  const res = await listarConversas('todos')

  return (
    <div className="max-w-6xl">
      <PageTitle icon={MessageCircle} subtitle="Conversas do robô do WhatsApp — Encomendas e Delivery">
        Atendimento
      </PageTitle>

      {res.error ? (
        <p className="text-sm text-danger bg-danger-tint rounded-lg px-3 py-2">{res.error}</p>
      ) : (
        <AtendimentoView conversasIniciais={res.data?.conversas ?? []} />
      )}
    </div>
  )
}
