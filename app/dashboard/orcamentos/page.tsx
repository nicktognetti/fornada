import { listarOrcamentos } from '@/app/actions/orcamento'
import { OrcamentosList } from './orcamentos-list'

export default async function OrcamentosPage() {
  const r = await listarOrcamentos()
  return <OrcamentosList inicial={r.data ?? []} />
}
