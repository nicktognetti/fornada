export function parseDecimalBR(val: string): number {
  return parseFloat(val.trim().replace(/\./g, '').replace(',', '.'))
}

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatCustoUso(value: number, unidade: string): string {
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
