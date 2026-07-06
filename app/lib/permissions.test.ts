import { describe, it, expect } from 'vitest'
import { getAcesso, isGlobalAdmin, TELAS, TELA_LABEL, type PermissaoMap } from './permissions'

const LOJA_A = 'aaaaaaaa-0000-0000-0000-000000000000'

describe('isGlobalAdmin', () => {
  it('true quando há entrada * = admin com escopo global', () => {
    const map: PermissaoMap = { '*': { tela: '*', acesso: 'admin', unidade_id: null } }
    expect(isGlobalAdmin(map)).toBe(true)
  })

  it('false quando * = admin mas com escopo de unidade', () => {
    const map: PermissaoMap = { '*': { tela: '*', acesso: 'admin', unidade_id: LOJA_A } }
    expect(isGlobalAdmin(map)).toBe(false)
  })

  it('false para mapa vazio', () => {
    expect(isGlobalAdmin({})).toBe(false)
  })
})

describe('getAcesso', () => {
  it('admin global devolve admin para qualquer tela', () => {
    const map: PermissaoMap = { '*': { tela: '*', acesso: 'admin', unidade_id: null } }
    expect(getAcesso(map, 'insumos')).toBe('admin')
    expect(getAcesso(map, 'configuracoes')).toBe('admin')
  })

  it('devolve o acesso da tela concedida', () => {
    const map: PermissaoMap = { insumos: { tela: 'insumos', acesso: 'escrita', unidade_id: null } }
    expect(getAcesso(map, 'insumos')).toBe('escrita')
  })

  it('devolve null para tela não concedida', () => {
    const map: PermissaoMap = { insumos: { tela: 'insumos', acesso: 'escrita', unidade_id: null } }
    expect(getAcesso(map, 'painel')).toBe(null)
  })

  it('devolve null para mapa vazio (usuário desabilitado)', () => {
    expect(getAcesso({}, 'insumos')).toBe(null)
  })
})

describe('TELAS', () => {
  it('inclui a tela do módulo de atendimento (agente WhatsApp)', () => {
    expect(TELAS).toContain('atendimento')
    expect(TELA_LABEL.atendimento).toBe('Atendimento')
  })

  it('toda tela tem label', () => {
    for (const tela of TELAS) expect(TELA_LABEL[tela]).toBeTruthy()
  })
})
