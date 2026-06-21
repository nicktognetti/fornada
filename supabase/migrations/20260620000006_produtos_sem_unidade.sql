-- ============================================================
-- Migration: associar produtos sem unidade_id à unidade da empresa
-- Data: 20/06/2026
--
-- CONTEXTO:
--   Após a refatoração para o modelo produto (20260621000000),
--   produtos criados a partir de receitas herdaram unidade_id
--   via JOIN, mas produtos de revenda ou receitas sem unidade
--   podem ter ficado com unidade_id = NULL.
--
--   Produtos sem unidade_id são invisíveis no filtro por unidade
--   do UnidadeSelector e não geram produto_preco (pois o upsert
--   exige unidade_id NOT NULL).
--
-- ESTRATÉGIA:
--   Para cada produto com unidade_id IS NULL, associar à primeira
--   unidade ativa da mesma empresa (ordenada por nome).
--   Se a empresa tiver mais de uma unidade, o produto vai para a
--   unidade "padrão" — a Natali pode mover manualmente depois.
--
-- IDEMPOTENTE: atualiza apenas produtos ainda sem unidade_id.
-- ============================================================

-- ── 1. Associar produtos sem unidade_id ───────────────────────────────────────

UPDATE public.produto p
SET unidade_id = (
  SELECT u.id
  FROM public.unidade u
  WHERE u.empresa_id = p.empresa_id
    AND u.ativa = true
  ORDER BY u.nome
  LIMIT 1
)
WHERE p.unidade_id IS NULL
  AND p.empresa_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.unidade u2
    WHERE u2.empresa_id = p.empresa_id AND u2.ativa = true
  );

-- ── 2. Diagnóstico pós-update (rodar manualmente para verificar) ──────────────
--
--   SELECT
--     COUNT(*) FILTER (WHERE unidade_id IS NULL)     AS ainda_sem_unidade,
--     COUNT(*) FILTER (WHERE unidade_id IS NOT NULL) AS com_unidade,
--     COUNT(*)                                       AS total
--   FROM public.produto
--   WHERE ativo = true;
--
--   Resultado esperado: ainda_sem_unidade = 0
