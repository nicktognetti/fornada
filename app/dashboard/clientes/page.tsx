import { listarClientes } from '@/app/actions/cliente'
import { ClientesList } from './clientes-list'

export default async function ClientesPage() {
  const res = await listarClientes()
  return <ClientesList inicial={res.data ?? []} erro={res.error} />
}
