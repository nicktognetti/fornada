// Cálculos puros de orçamento/encomenda — sem dependência de servidor/DOM,
// para poder testar isoladamente. Usado nas actions (subtotal/total) e nos
// builders (preço com ajuste %, total ao vivo).

/** Arredonda para 2 casas (centavos), evitando lixo de ponto flutuante. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Preço unitário = preço base ajustado por uma porcentagem (ex.: +10%, -5%). */
export function precoComAjuste(base: number, pct: number): number {
  if (!(base > 0) || !Number.isFinite(pct)) return base
  return round2(base * (1 + pct / 100))
}

/** Subtotal de um item = quantidade × preço unitário. */
export function subtotalItem(quantidade: number, precoUnitario: number): number {
  if (!(quantidade > 0) || !(precoUnitario >= 0)) return 0
  return round2(quantidade * precoUnitario)
}

/** Total de um pedido = soma dos subtotais dos itens. */
export function totalPedido(itens: { quantidade: number; precoUnitario: number }[]): number {
  return round2(itens.reduce((s, i) => s + subtotalItem(i.quantidade, i.precoUnitario), 0))
}
