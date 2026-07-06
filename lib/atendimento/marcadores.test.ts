import { describe, it, expect } from 'vitest'
import { extrairEncomenda, extrairFoto, limparVazamentoDeFerramenta } from './marcadores'
import { calcularDisponibilidade } from './disponibilidade'
import { formatarAvisoPedido, formatarAvisoPedidoLinha } from './aviso-texto'
import { formatarFichaCliente } from './ficha-texto'
import { formatarInfoLoja } from './info-texto'

describe('extrairEncomenda', () => {
  it('sem marcação: devolve o texto intacto e encomenda null', () => {
    const r = extrairEncomenda('Olá! Como posso ajudar?')
    expect(r.textoLimpo).toBe('Olá! Como posso ajudar?')
    expect(r.encomenda).toBeNull()
  })

  it('extrai encomenda de retirada (canal encomendas) e limpa o texto', () => {
    const r = extrairEncomenda(
      'Anotado! 2 bolos para sábado às 14h, no nome da Maria. 😊\n#ENCOMENDA# {"produto":"bolo de fubá","quantidade":"2","data":"sábado 14h","nome":"Maria"}'
    )
    expect(r.textoLimpo).toBe('Anotado! 2 bolos para sábado às 14h, no nome da Maria. 😊')
    expect(r.encomenda).toEqual({
      produto: 'bolo de fubá',
      quantidade: '2',
      data: 'sábado 14h',
      nome: 'Maria',
      endereco: null,
    })
  })

  it('extrai pedido de delivery com endereço', () => {
    const r = extrairEncomenda(
      'Anotado, João!\n#ENCOMENDA# {"produto":"pão francês","quantidade":"10","data":"hoje","nome":"João","endereco":"Rua das Flores, 123"}'
    )
    expect(r.encomenda?.endereco).toBe('Rua das Flores, 123')
    expect(r.textoLimpo).toBe('Anotado, João!')
  })

  it('JSON quebrado: remove a linha e não vaza código para o cliente', () => {
    const r = extrairEncomenda('Anotado!\n#ENCOMENDA# {produto sem aspas}')
    expect(r.textoLimpo).toBe('Anotado!')
    expect(r.encomenda).toBeNull()
  })
})

describe('extrairFoto', () => {
  it('extrai o produto da foto e limpa o texto', () => {
    const r = extrairFoto('Olha que lindo!\n#FOTO# {"produto":"Bolo de Cenoura"}')
    expect(r.textoLimpo).toBe('Olha que lindo!')
    expect(r.produtoDaFoto).toBe('Bolo de Cenoura')
  })

  it('sem marcação: nada muda', () => {
    const r = extrairFoto('Sem foto aqui.')
    expect(r.produtoDaFoto).toBeNull()
  })
})

describe('limparVazamentoDeFerramenta', () => {
  it('remove pseudo-chamada de ferramenta vazada pelo llama', () => {
    const r = limparVazamentoDeFerramenta(
      'O pão brioche não é vendido por este canal. <function=consultar_produtos>{"termo":"pao"}</function>'
    )
    expect(r).toBe('O pão brioche não é vendido por este canal.')
  })

  it('remove fragmento sem fechamento', () => {
    expect(limparVazamentoDeFerramenta('Claro! <function=consultar_produtos [{"termo": "x"}]')).toBe('Claro!')
  })

  it('texto normal passa intacto', () => {
    expect(limparVazamentoDeFerramenta('Bom dia! Como posso ajudar?')).toBe('Bom dia! Como posso ajudar?')
  })
})

describe('calcularDisponibilidade (canais encomendas × delivery)', () => {
  const base = { sempre_disponivel: false, disponivel_hoje: null, vende_delivery: true, vende_encomenda: false }

  it('produto fora do canal → nao_vendido_neste_canal', () => {
    expect(calcularDisponibilidade(base, 'encomendas')).toBe('nao_vendido_neste_canal')
    expect(calcularDisponibilidade({ ...base, vende_delivery: false }, 'delivery')).toBe('nao_vendido_neste_canal')
  })

  it('sempre_disponivel vence o toggle diário', () => {
    expect(calcularDisponibilidade({ ...base, sempre_disponivel: true, disponivel_hoje: false }, 'delivery')).toBe('sempre_tem')
  })

  it('toggle diário: tem/acabou/não informado', () => {
    expect(calcularDisponibilidade({ ...base, disponivel_hoje: true }, 'delivery')).toBe('tem_hoje')
    expect(calcularDisponibilidade({ ...base, disponivel_hoje: false }, 'delivery')).toBe('acabou_hoje')
    expect(calcularDisponibilidade(base, 'delivery')).toBe('confirmar_com_equipe')
  })

  it('flags ausentes (produto sem linha): seguro por padrão', () => {
    expect(calcularDisponibilidade(undefined, 'delivery')).toBe('confirmar_com_equipe')
  })
})

describe('formatarInfoLoja (dados oficiais no prompt)', () => {
  it('com dados: monta o bloco e mantém a regra de ouro', () => {
    const txt = formatarInfoLoja({
      horarios: 'seg a sáb 6h–19h',
      endereco: 'Rua do Trigo, 100',
      pagamento: 'pix e cartão',
      entrega: 'taxa R$ 5 no centro',
      extra: null,
    })
    expect(txt).toContain('Informações OFICIAIS desta loja')
    expect(txt).toContain('Horários de funcionamento: seg a sáb 6h–19h')
    expect(txt).toContain('Entrega (taxa/área/tempo): taxa R$ 5 no centro')
    expect(txt).not.toContain('Outras informações')
    expect(txt).toContain('regra de ouro')
  })

  it('tudo vazio ou null: retorna null (prompt fica no modo recepcionista)', () => {
    expect(formatarInfoLoja(null)).toBeNull()
    expect(formatarInfoLoja({ horarios: null, endereco: null, pagamento: null, entrega: null, extra: null })).toBeNull()
  })
})

describe('formatarAvisoPedidoLinha (parâmetro de template Meta)', () => {
  it('linha única, sem \\n nem tab (regra da Meta)', () => {
    const linha = formatarAvisoPedidoLinha(
      'delivery',
      { produto: '10 pães', quantidade: '10', data: 'hoje', nome: 'João', endereco: 'Rua A,\n123' },
      'Morada do Sol',
      '5511999990002',
    )
    expect(linha).not.toMatch(/[\n\t]/)
    expect(linha).toContain('PEDIDO DE DELIVERY — Morada do Sol')
    expect(linha).toContain('entregar em: Rua A, 123')
    expect(linha).toContain('whatsapp: 5511999990002')
  })
})

describe('formatarFichaCliente (memória do cliente no prompt)', () => {
  it('cliente conhecido: nome, endereço salvo e últimos pedidos', () => {
    const txt = formatarFichaCliente({
      nome: 'Maria',
      endereco: 'Rua das Flores, 123',
      observacao: null,
      ultimosPedidos: [{ produto: 'bolo de fubá', quando: '05/07' }],
    })
    expect(txt).toContain('Sobre este cliente')
    expect(txt).toContain('Nome: Maria')
    expect(txt).toContain('Endereço salvo: Rua das Flores, 123')
    expect(txt).toContain('bolo de fubá (05/07)')
    expect(txt).toContain('SEMPRE confirme antes')
  })

  it('cliente desconhecido (sem nada): null — prompt fica limpo', () => {
    expect(formatarFichaCliente({ nome: null, endereco: null, observacao: null, ultimosPedidos: [] })).toBeNull()
  })
})

describe('formatarAvisoPedido (aviso à equipe)', () => {
  it('delivery: título de delivery + endereço', () => {
    const txt = formatarAvisoPedido(
      'delivery',
      { produto: '10 pães', quantidade: '10', data: 'hoje', nome: 'João', endereco: 'Rua das Flores, 123' },
      'Morada do Sol',
      '5511999990002',
    )
    expect(txt).toContain('🛵 PEDIDO DE DELIVERY — Morada do Sol')
    expect(txt).toContain('Entregar em: Rua das Flores, 123')
    expect(txt).toContain('Cliente: João')
    expect(txt).toContain('WhatsApp: 5511999990002')
  })

  it('encomendas: título de encomenda + retirada; omite campos "?"', () => {
    const txt = formatarAvisoPedido(
      'encomendas',
      { produto: 'bolo de fubá', quantidade: '?', data: 'sábado 14h', nome: '?', endereco: null },
      'Centro',
      '5511999990001',
    )
    expect(txt).toContain('📝 NOVA ENCOMENDA — Centro')
    expect(txt).toContain('Retirada: sábado 14h')
    expect(txt).not.toContain('Quantidade:')
    expect(txt).not.toContain('Cliente: ?')
  })
})
