import { describe, it, expect } from 'vitest'
import { avaliaAcesso, isAdminGlobal, type PermissaoLike } from './authz-core'

const adminGlobal: PermissaoLike = { tela: '*', acesso: 'admin', unidade_id: null }

const LOJA_A = 'aaaaaaaa-0000-0000-0000-000000000000'
const LOJA_B = 'bbbbbbbb-0000-0000-0000-000000000000'

describe('isAdminGlobal', () => {
  it('reconhece admin global (tela=*, admin, escopo null)', () => {
    expect(isAdminGlobal([adminGlobal])).toBe(true)
  })

  it('NÃO é admin global se o escopo tem unidade', () => {
    expect(isAdminGlobal([{ tela: '*', acesso: 'admin', unidade_id: LOJA_A }])).toBe(false)
  })

  it('NÃO é admin global se o acesso é abaixo de admin', () => {
    expect(isAdminGlobal([{ tela: '*', acesso: 'escrita', unidade_id: null }])).toBe(false)
  })

  it('lista vazia (usuário desabilitado) não é admin', () => {
    expect(isAdminGlobal([])).toBe(false)
  })
})

describe('avaliaAcesso — admin global', () => {
  it('admin global passa em qualquer tela, nível e unidade', () => {
    expect(avaliaAcesso([adminGlobal], ['insumos'], { nivel: 'admin', unidadeId: LOJA_B })).toBe(true)
    expect(avaliaAcesso([adminGlobal], ['qualquer'], { nivel: 'admin' })).toBe(true)
  })
})

describe('avaliaAcesso — usuário sem permissão', () => {
  it('lista vazia nega tudo (desabilitado)', () => {
    expect(avaliaAcesso([], ['insumos'])).toBe(false)
    expect(avaliaAcesso([], ['insumos'], { nivel: 'leitura' })).toBe(false)
  })
})

describe('avaliaAcesso — match de tela', () => {
  const perms: PermissaoLike[] = [{ tela: 'insumos', acesso: 'escrita', unidade_id: null }]

  it('concede quando a tela está na lista pedida', () => {
    expect(avaliaAcesso(perms, ['insumos'])).toBe(true)
  })

  it('concede quando UMA das telas pedidas bate (OR)', () => {
    expect(avaliaAcesso(perms, ['painel', 'insumos'])).toBe(true)
  })

  it('nega quando nenhuma tela pedida bate', () => {
    expect(avaliaAcesso(perms, ['receitas'])).toBe(false)
  })
})

describe('avaliaAcesso — hierarquia de nível (leitura < escrita < admin)', () => {
  it('escrita satisfaz pedido de leitura', () => {
    const perms: PermissaoLike[] = [{ tela: 'insumos', acesso: 'escrita', unidade_id: null }]
    expect(avaliaAcesso(perms, ['insumos'], { nivel: 'leitura' })).toBe(true)
  })

  it('leitura NÃO satisfaz pedido de escrita', () => {
    const perms: PermissaoLike[] = [{ tela: 'insumos', acesso: 'leitura', unidade_id: null }]
    expect(avaliaAcesso(perms, ['insumos'], { nivel: 'escrita' })).toBe(false)
  })

  it('escrita NÃO satisfaz pedido de admin', () => {
    const perms: PermissaoLike[] = [{ tela: 'transferencias', acesso: 'escrita', unidade_id: null }]
    expect(avaliaAcesso(perms, ['transferencias'], { nivel: 'admin' })).toBe(false)
  })

  it('admin satisfaz pedido de admin', () => {
    const perms: PermissaoLike[] = [{ tela: 'transferencias', acesso: 'admin', unidade_id: null }]
    expect(avaliaAcesso(perms, ['transferencias'], { nivel: 'admin' })).toBe(true)
  })

  it('padrão (sem nível) exige escrita', () => {
    const perms: PermissaoLike[] = [{ tela: 'insumos', acesso: 'leitura', unidade_id: null }]
    expect(avaliaAcesso(perms, ['insumos'])).toBe(false)
  })
})

describe('avaliaAcesso — escopo por loja (o ponto que evita vazamento)', () => {
  const soLojaA: PermissaoLike[] = [{ tela: 'insumos', acesso: 'escrita', unidade_id: LOJA_A }]

  it('permissão da Loja A concede na Loja A', () => {
    expect(avaliaAcesso(soLojaA, ['insumos'], { unidadeId: LOJA_A })).toBe(true)
  })

  it('permissão da Loja A NEGA na Loja B', () => {
    expect(avaliaAcesso(soLojaA, ['insumos'], { unidadeId: LOJA_B })).toBe(false)
  })

  it('permissão GLOBAL (unidade_id null) concede em qualquer loja', () => {
    const global: PermissaoLike[] = [{ tela: 'insumos', acesso: 'escrita', unidade_id: null }]
    expect(avaliaAcesso(global, ['insumos'], { unidadeId: LOJA_A })).toBe(true)
    expect(avaliaAcesso(global, ['insumos'], { unidadeId: LOJA_B })).toBe(true)
  })

  it('sem unidadeId no pedido, qualquer escopo serve (gate só de módulo)', () => {
    expect(avaliaAcesso(soLojaA, ['insumos'])).toBe(true)
  })

  it('com várias lojas, concede só na loja certa', () => {
    const multi: PermissaoLike[] = [
      { tela: 'receber', acesso: 'escrita', unidade_id: LOJA_A },
      { tela: 'insumos', acesso: 'escrita', unidade_id: LOJA_B },
    ]
    // insumos só foi concedido na Loja B
    expect(avaliaAcesso(multi, ['insumos'], { unidadeId: LOJA_B })).toBe(true)
    expect(avaliaAcesso(multi, ['insumos'], { unidadeId: LOJA_A })).toBe(false)
  })
})
