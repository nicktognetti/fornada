-- ============================================================
-- Migration: consolidar preços de receita_preco → produto_preco
-- Data: 20/06/2026
--
-- CONTEXTO:
--   O sistema foi refatorado de `receita` como entidade de
--   precificação para `produto` como entidade de 1ª classe.
--   A tabela `receita_preco` (legada) registrava preço de venda
--   diretamente na receita. Agora o preço fica em `produto_preco`
--   com chave (produto_id, unidade_id).
--
-- OBJETIVO:
--   Garantir que nenhum preço de `receita_preco` se perca.
--   Para cada receita com preço: se existir um produto associado
--   (produto.receita_id = receita_preco.receita_id) e ainda não
--   houver linha em produto_preco para esse par (produto, unidade),
--   copia o preço.
--
-- NOTA:
--   A migration 20260621000000_produto_financeiro.sql já executa
--   esta cópia na seção 6 como parte da criação inicial do módulo
--   produto. Esta migration é um SAFETY NET idempotente para
--   execuções futuras ou bancos onde 20260621000000 foi parcial.
--
-- RESTRIÇÕES:
--   - NÃO dropa receita_preco (dados legados mantidos como auditoria)
--   - ON CONFLICT DO NOTHING — não sobrescreve preços manuais novos
-- ============================================================

-- ── 1. Copiar preços de receita_preco → produto_preco (idempotente) ───────────

INSERT INTO public.produto_preco (produto_id, unidade_id, preco_praticado, volume_mensal)
SELECT
  p.id                               AS produto_id,
  COALESCE(p.unidade_id, r.unidade_id) AS unidade_id,
  rp.preco_venda                     AS preco_praticado,
  0                                  AS volume_mensal
FROM public.produto p
JOIN public.receita_preco rp  ON rp.receita_id  = p.receita_id
JOIN public.receita r         ON r.id            = p.receita_id
WHERE p.receita_id IS NOT NULL
  AND COALESCE(p.unidade_id, r.unidade_id) IS NOT NULL
ON CONFLICT (produto_id, unidade_id) DO NOTHING;

-- ── 2. Garantir que produtos 'revenda' sem preço estejam representados ─────────
-- Não há preços legados para produtos de revenda (não existiam antes);
-- esta seção é apenas um marcador documental — sem operação.

-- ── 3. Verificação diagnóstica (somente comentário — rodar manualmente) ────────
--
--   Para verificar se algum preço ficou sem migrar:
--
--   SELECT
--     r.nome         AS receita_nome,
--     rp.preco_venda AS preco_legado,
--     p.id           AS produto_id,
--     pp.preco_praticado AS preco_atual
--   FROM public.receita_preco rp
--   JOIN public.receita r ON r.id = rp.receita_id
--   LEFT JOIN public.produto p ON p.receita_id = rp.receita_id
--   LEFT JOIN public.produto_preco pp ON pp.produto_id = p.id
--   WHERE pp.id IS NULL
--   ORDER BY r.nome;
--
--   Resultado vazio = migração completa.
