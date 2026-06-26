export type NivelAcesso = 'leitura' | 'escrita' | 'admin'

export type Permissao = {
  tela: string
  acesso: NivelAcesso
  unidade_id: string | null
}

export type PermissaoMap = Record<string, Permissao>

export const TELAS = [
  'resumo',
  'insumos',
  'receitas',
  'precos',
  'produtos',
  'painel',
  'cadastros',
  'simulador',
  'transferencias',
  'receber',
  'configuracoes',
] as const

export type TelaSlug = (typeof TELAS)[number]

export const TELA_LABEL: Record<TelaSlug, string> = {
  resumo:          'Resumo',
  insumos:         'Insumos',
  receitas:        'Fichas Técnicas',
  precos:          'Preços',
  produtos:        'Produtos',
  painel:          'Painel Financeiro',
  cadastros:       'Cadastros',
  simulador:       'Simulador',
  transferencias:  'Transferências',
  receber:         'Receber',
  configuracoes:   'Configurações',
}

// Retorna true se o mapa de permissões concede acesso admin global
export function isGlobalAdmin(map: PermissaoMap): boolean {
  const p = map['*']
  return p?.acesso === 'admin' && p.unidade_id === null
}

// Retorna o acesso do usuário a uma tela específica.
// Admin global ('*') sobrepõe tudo.
export function getAcesso(map: PermissaoMap, tela: string): NivelAcesso | null {
  if (isGlobalAdmin(map)) return 'admin'
  const p = map[tela]
  if (!p) return null
  return p.acesso
}
