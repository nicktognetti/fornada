/**
 * Converte uma string em notação monetária/numérica brasileira para `number`.
 *
 * Função **pura** e tolerante a ruído ("R$", espaços, "%", etc.).
 *
 * Convenção brasileira:
 *  - A **vírgula** é o separador decimal; o **ponto** é separador de milhar.
 *    Ex.: `"1.234,56"` → `1234.56`, `"10,5"` → `10.5`.
 *  - Sem vírgula, pontos que formam grupos de 3 dígitos são tratados como
 *    milhar (`"1.000"` → `1000`, `"1.234"` → `1234`); caso contrário o ponto
 *    é interpretado como decimal (`"10.50"` → `10.5`, `"10.00"` → `10`).
 *  - Sinal de menos no início é preservado (`"-10,5"` → `-10.5`).
 *
 * Segurança: entrada vazia, nula ou sem dígitos válidos retorna **`NaN`**.
 * `NaN` é o sinalizador de "valor inválido" — sempre verifique com
 * `Number.isNaN(...)` antes de persistir ou exibir. Nunca grave o retorno
 * sem validar.
 */
export function parseDecimalBR(val: string | null | undefined): number {
  if (val == null) return NaN

  // Mantém apenas dígitos, separadores (.,) e o sinal de menos.
  const cleaned = String(val).replace(/[^\d.,-]/g, '')
  if (cleaned === '') return NaN

  // Negativo apenas se o sinal aparecer antes de qualquer dígito.
  const negative = /^-/.test(cleaned)
  const digitsAndSeps = cleaned.replace(/-/g, '')
  if (digitsAndSeps === '') return NaN

  let normalized: string
  if (digitsAndSeps.includes(',')) {
    // Vírgula presente: ela é o decimal; pontos são milhar.
    normalized = digitsAndSeps.replace(/\./g, '').replace(',', '.')
  } else if (digitsAndSeps.includes('.')) {
    // Sem vírgula: decidir se os pontos são milhar ou decimal.
    const parts = digitsAndSeps.split('.')
    const looksLikeThousands =
      parts.length > 1 &&
      parts[0].length >= 1 &&
      parts[0].length <= 3 &&
      parts.slice(1).every((p) => p.length === 3)
    normalized = looksLikeThousands ? parts.join('') : digitsAndSeps
  } else {
    normalized = digitsAndSeps
  }

  const n = Number(normalized)
  if (!Number.isFinite(n)) return NaN
  return negative ? -n : n
}

/**
 * Formata um número como valor em reais (sem o prefixo "R$").
 * Tolerante a entradas inválidas: `NaN`/`Infinity` viram `"0,00"`.
 */
export function formatBRL(value: number): string {
  if (!Number.isFinite(value)) return '0,00'
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Formata um custo por unidade de uso, ex.: `"R$ 0,0420/g"`.
 * Usa 4 casas para valores pequenos (< 0,1) e 2 nos demais.
 * Tolerante a entradas inválidas.
 */
export function formatCustoUso(value: number, unidade: string): string {
  if (!Number.isFinite(value)) return 'R$ 0,00/' + unidade
  const decimals = value < 0.1 ? 4 : 2
  return (
    'R$ ' +
    value.toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }) +
    '/' +
    unidade
  )
}

export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}
