// Tipos puros do canal de atendimento (sem dependência de banco/env),
// compartilhados entre servidor, componentes client e testes.

export type CanalAtendimento = 'encomendas' | 'delivery'

export const CANAL_LABEL: Record<CanalAtendimento, string> = {
  encomendas: 'Encomendas',
  delivery: 'Delivery',
}
