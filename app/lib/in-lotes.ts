// Consulta `.in(ids)` em LOTES.
//
// Acima de ~200 UUIDs o filtro vai todo na URL (PostgREST usa GET) e estoura
// o limite do servidor — a query falha e, se ninguém checa o {error}, falha
// em silêncio. Confirmado em produção em 11/09/2026: com 1112 insumos, as
// cargas de custo/preço da tela de Insumos falhavam TODAS e cada item
// aparecia como "Sem preço" — induzindo reprecificação e preço duplicado.
//
// Uso:
//   const custos = await emLotes<Row>(ids, (lote) =>
//     supabase.from('vw_insumo_custo_atual').select('insumo_id, custo_uso').in('insumo_id', lote))
//
// Lança em erro (nada de falha silenciosa): a página mostra o error boundary
// em vez de fingir que não há dados.

const TAMANHO_LOTE = 150

export async function emLotes<T>(
  ids: string[],
  consulta: (lote: string[]) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const resultado: T[] = []
  for (let i = 0; i < ids.length; i += TAMANHO_LOTE) {
    const { data, error } = await consulta(ids.slice(i, i + TAMANHO_LOTE))
    if (error) throw new Error(`Erro na consulta em lote: ${error.message}`)
    resultado.push(...((data as T[]) ?? []))
  }
  return resultado
}
