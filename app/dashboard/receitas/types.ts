export type ReceitaTipo = 'final' | 'base'

export type Dificuldade = 'facil' | 'media' | 'dificil'

export interface Receita {
  id: string
  empresa_id: string
  unidade_id: string
  nome: string
  tipo: ReceitaTipo
  // Setor a que a receita pertence (Confeitaria, Padaria, Salgados…). Texto livre.
  categoria: string | null
  rendimento: number
  rendimento_unidade: string
  ativo: boolean
  observacao: string | null
  // Caderno de receitas (modo de fazer)
  passos: string[]
  tempo_preparo_min: number | null
  temperatura_forno: number | null
  tempo_forno_min: number | null
  dificuldade: Dificuldade | null
  foto_url: string | null
  // Criada/alterada pela produção no Caderno, aguardando a Natali precificar.
  revisao_pendente: boolean
}

export interface ReceitaComCusto extends Receita {
  custo_total: number | null
  custo_unitario: number | null
}

export interface InsumoRef {
  id: string
  nome: string
  unidade_uso: string
}

export interface SubReceitaRef {
  id: string
  nome: string
  rendimento_unidade: string
}

export interface ReceitaItem {
  id: string
  receita_id: string
  insumo_id: string | null
  sub_receita_id: string | null
  quantidade: number
  insumo: InsumoRef | null
  sub_receita: SubReceitaRef | null
}

export interface ReceitaItemComCusto extends ReceitaItem {
  nome_display: string
  unidade: string
  custo_unitario: number | null
  custo_item: number | null
  is_pendente: boolean
}

export interface InsumoOpcao {
  id: string
  nome: string
  categoria: string | null
  unidade_uso: string
}

export type ActionResult = { error?: string; success?: boolean }
