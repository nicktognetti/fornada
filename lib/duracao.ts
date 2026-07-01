// Formata uma duração (em milissegundos) de forma curta e legível em PT-BR.
// Ex.: 90min → "1h 30min"; 2 dias e 3h → "2d 3h"; 30s → "menos de 1min".
export function formatDuracao(ms: number): string {
  if (!isFinite(ms) || ms < 0) return '—'
  if (ms < 60_000) return 'menos de 1min'

  const dias = Math.floor(ms / 86_400_000)
  const horas = Math.floor((ms % 86_400_000) / 3_600_000)
  const mins = Math.floor((ms % 3_600_000) / 60_000)

  if (dias > 0) return horas > 0 ? `${dias}d ${horas}h` : `${dias}d`
  if (horas > 0) return mins > 0 ? `${horas}h ${mins}min` : `${horas}h`
  return `${mins}min`
}
