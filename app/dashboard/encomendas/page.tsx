import { listarEncomendas } from '@/app/actions/encomenda'
import { EncomendasList } from './encomendas-list'

export default async function EncomendasPage() {
  const r = await listarEncomendas()
  return <EncomendasList inicial={r.data?.itens ?? []} podeVerValores={r.data?.podeVerValores ?? false} />
}
