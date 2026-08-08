import { describe, it, expect } from 'vitest'
import { calcularFunil, formatDuracaoCurta, type MensagemMetrica } from './atendimento-metricas'

const T0 = '2026-08-01T12:00:00.000Z'
function em(segundos: number): string {
  return new Date(new Date(T0).getTime() + segundos * 1000).toISOString()
}
function msg(conversa_id: string, role: 'user' | 'assistant', segundos: number): MensagemMetrica {
  return { conversa_id, role, criado_em: em(segundos) }
}

describe('calcularFunil', () => {
  it('conta conversas distintas, não mensagens', () => {
    const f = calcularFunil([
      msg('c1', 'user', 0), msg('c1', 'assistant', 5),
      msg('c1', 'user', 10), msg('c1', 'assistant', 15),
      msg('c2', 'user', 0), msg('c2', 'assistant', 8),
    ], new Set())

    expect(f.conversasAtendidas).toBe(2)
    expect(f.mensagensCliente).toBe(3)
    expect(f.mensagensRobo).toBe(3)
  })

  it('calcula a taxa de conversão conversa → pedido', () => {
    const f = calcularFunil([
      msg('c1', 'user', 0), msg('c2', 'user', 0), msg('c3', 'user', 0), msg('c4', 'user', 0),
    ], new Set(['c1']))

    expect(f.conversasComPedido).toBe(1)
    expect(f.taxaConversao).toBe(25)
  })

  it('ignora pedido de conversa sem atividade no período', () => {
    // 'antiga' gerou pedido em outro mês; não deve inflar a conversão do mês atual.
    const f = calcularFunil([msg('c1', 'user', 0), msg('c1', 'assistant', 3)], new Set(['c1', 'antiga']))

    expect(f.conversasAtendidas).toBe(1)
    expect(f.conversasComPedido).toBe(1)
    expect(f.taxaConversao).toBe(100)
  })

  it('usa MEDIANA do tempo de resposta (uma travada não distorce)', () => {
    const f = calcularFunil([
      msg('c1', 'user', 0), msg('c1', 'assistant', 2),      // 2s
      msg('c2', 'user', 0), msg('c2', 'assistant', 4),      // 4s
      msg('c3', 'user', 0), msg('c3', 'assistant', 600),    // 10min — outlier
    ], new Set())

    // média seria ~202s; mediana é 4s
    expect(f.medianaRespostaSegundos).toBe(4)
  })

  it('mensagens seguidas do cliente contam a espera desde a PRIMEIRA', () => {
    const f = calcularFunil([
      msg('c1', 'user', 0),   // cliente começa a esperar aqui
      msg('c1', 'user', 3),
      msg('c1', 'user', 6),
      msg('c1', 'assistant', 10),
    ], new Set())

    expect(f.medianaRespostaSegundos).toBe(10)
  })

  it('conta várias idas e voltas na mesma conversa', () => {
    const f = calcularFunil([
      msg('c1', 'user', 0), msg('c1', 'assistant', 2),
      msg('c1', 'user', 20), msg('c1', 'assistant', 26),
    ], new Set())

    // esperas: 2s e 6s → mediana 4
    expect(f.medianaRespostaSegundos).toBe(4)
  })

  it('resposta do robô sem pergunta antes não vira espera negativa', () => {
    const f = calcularFunil([
      msg('c1', 'assistant', 0),  // robô falou primeiro (aviso da equipe)
      msg('c1', 'assistant', 5),
    ], new Set())

    expect(f.medianaRespostaSegundos).toBeNull()
  })

  it('mensagens fora de ordem são ordenadas antes do cálculo', () => {
    const f = calcularFunil([
      msg('c1', 'assistant', 10),
      msg('c1', 'user', 4),
    ], new Set())

    expect(f.medianaRespostaSegundos).toBe(6)
  })

  it('média de mensagens por conversa com 1 casa decimal', () => {
    const f = calcularFunil([
      msg('c1', 'user', 0), msg('c1', 'assistant', 1), msg('c1', 'user', 2),
      msg('c2', 'user', 0), msg('c2', 'assistant', 1),
    ], new Set())

    expect(f.mediaMensagensPorConversa).toBe(2.5)
  })

  it('período vazio devolve zeros sem quebrar', () => {
    const f = calcularFunil([], new Set())
    expect(f).toMatchObject({
      conversasAtendidas: 0, conversasComPedido: 0, taxaConversao: 0,
      mediaMensagensPorConversa: 0, medianaRespostaSegundos: null,
    })
  })

  it('data inválida não derruba o cálculo', () => {
    const f = calcularFunil([
      { conversa_id: 'c1', role: 'user', criado_em: 'nao-e-data' },
      msg('c1', 'assistant', 5),
    ], new Set())

    expect(f.conversasAtendidas).toBe(1)
    expect(f.medianaRespostaSegundos).toBeNull()
  })
})

describe('formatDuracaoCurta', () => {
  it('formata segundos, minutos e horas', () => {
    expect(formatDuracaoCurta(12)).toBe('12s')
    expect(formatDuracaoCurta(90)).toBe('1min 30s')
    expect(formatDuracaoCurta(120)).toBe('2min')
    expect(formatDuracaoCurta(7500)).toBe('2h 5min')
    expect(formatDuracaoCurta(7200)).toBe('2h')
  })

  it('sem dado vira travessão', () => {
    expect(formatDuracaoCurta(null)).toBe('—')
  })
})
